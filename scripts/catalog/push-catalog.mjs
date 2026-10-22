#!/usr/bin/env node
/**
 * catalog:push — publishes the product catalog (data/catalog/<catalogId>.json)
 * to an Optimizely Graph EXTERNAL content source, so the storefront can query
 * products alongside CMS content through the normal Graph single key.
 *
 * This is the seed/demo loader. In the backlog, an OCP app (APP-002/003) takes
 * over the same job against the same schema — the frontend (lib/catalog.ts)
 * does not care which one wrote the data.
 *
 * Graph content-source API facts this relies on (verified 2026-09):
 *   - Auth: Basic base64(OPTIMIZELY_GRAPH_APP_KEY:OPTIMIZELY_GRAPH_SECRET).
 *   - Schema: PUT /api/content/v3/types?id=<source>. Type names must carry the
 *     `<source>_` prefix; nested objects are `propertyTypes`.
 *   - Data:   POST /api/content/v2/data?id=<source>, NDJSON index/delete pairs.
 *   - Properties declared `searchable` must be sent as `<Name>___searchable`,
 *     otherwise they read back null and full-text search ignores them.
 *   - Deleting uses NDJSON `{"delete":{…}}` lines — DELETE …/data?languages=
 *     returns 204 but removes nothing.
 *   - Languages: one document per `language_routing`, same _id. English carries
 *     the full record; fr/de/es carry only the translated text from each
 *     record's optional `i18n` block (lib/catalog.ts overlays it on English).
 *
 * Usage:
 *   node scripts/catalog/push-catalog.mjs [--dryRun] [--types-only] [--reset] [--catalog apparel]
 *     --dryRun      validate and print what would be sent; no network writes
 *     --types-only  (re)register the schema only
 *     --reset       delete every document of this catalog from the source
 * Env (from .env.<branch> or .env.local, same resolution as cms:push):
 *   OPTIMIZELY_GRAPH_APP_KEY, OPTIMIZELY_GRAPH_SECRET, OPTIMIZELY_GRAPH_SINGLE_KEY
 *   optional CATALOG_REVALIDATE_URL + CATALOG_REVALIDATE_SECRET to bust the site cache
 */
import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const SOURCE_ID = 'ret'
const GATEWAY = 'https://cg.optimizely.com'
const CURRENCIES = ['USD', 'GBP', 'EUR']
const HANDLE_RE = /^[a-z0-9][a-z0-9-]{0,79}$/
const LANGUAGES = ['en', 'fr', 'de', 'es']
const TEXT_FIELDS = ['name', 'description', 'fitNotes', 'materials', 'care']

const args = process.argv.slice(2)
const isDryRun = args.includes('--dryRun')
const typesOnly = args.includes('--types-only')
const isReset = args.includes('--reset')
const catalogId = args.includes('--catalog') ? args[args.indexOf('--catalog') + 1] : 'apparel'

// ── Env ─────────────────────────────────────────────────────────────────────
function resolveEnvFile() {
  if (process.env.CMS_ENV_FILE) return process.env.CMS_ENV_FILE
  let branch = ''
  try { branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim() } catch { /* not a repo */ }
  return [branch && `.env.${branch.replace(/\//g, '-')}`, '.env.local'].filter(Boolean).find((f) => existsSync(f))
}
const envFile = resolveEnvFile()
if (envFile) { try { process.loadEnvFile(envFile) } catch { /* ignore */ } }
console.log(`› catalog:push (${catalogId}) using ${envFile ?? 'process env'}${isDryRun ? ' — DRY RUN' : ''}`)

const { OPTIMIZELY_GRAPH_APP_KEY: APP_KEY, OPTIMIZELY_GRAPH_SECRET: SECRET, OPTIMIZELY_GRAPH_SINGLE_KEY: SINGLE_KEY } = process.env
if (!isDryRun && (!APP_KEY || !SECRET || !SINGLE_KEY)) {
  console.error('✖ OPTIMIZELY_GRAPH_APP_KEY, OPTIMIZELY_GRAPH_SECRET and OPTIMIZELY_GRAPH_SINGLE_KEY are required.')
  process.exit(1)
}
const basicAuth = () => 'Basic ' + Buffer.from(`${APP_KEY}:${SECRET}`).toString('base64')

// ── Schema ──────────────────────────────────────────────────────────────────
const prop = (type, searchable = false) => ({ type, searchable })
const SCHEMA = {
  label: 'Retail product catalog',
  languages: LANGUAGES,
  contentTypes: {
    ret_Product: {
      contentType: [], base: 'Block', displayName: 'Product',
      properties: {
        Handle: prop('String'), StyleId: prop('String'), CatalogId: prop('String'), Brand: prop('String'),
        Name: prop('String', true), Description: prop('String', true),
        Gender: prop('String'), PrimaryCategory: prop('String'), CategoryHandles: prop('[String]'),
        Collections: prop('[String]'), Badges: prop('[String]'), Materials: prop('[String]'), Care: prop('[String]'),
        Fit: prop('String'), FitNotes: prop('String'), Traits: prop('[String]'),
        Rating: prop('Float'), ReviewCount: prop('Int'), SortRank: prop('Int'), LaunchedAt: prop('String'),
        Url: prop('String'), Sizes: prop('[String]'), PairsWith: prop('[String]'),
        Colours: prop('[ret_Colour]'), Variants: prop('[ret_Variant]'), FromPrices: prop('[ret_Price]'),
      },
    },
    ret_Category: {
      contentType: [], base: 'Block', displayName: 'Category',
      properties: {
        Handle: prop('String'), CatalogId: prop('String'), Name: prop('String'), ParentHandle: prop('String'),
        Gender: prop('String'), Url: prop('String'), SortRank: prop('Int'),
      },
    },
  },
  propertyTypes: {
    ret_Colour:  { properties: { Code: prop('String'), Name: prop('String'), Hex: prop('String'), Images: prop('[String]') } },
    ret_Price:   { properties: { Currency: prop('String'), Amount: prop('Int'), CompareAt: prop('Int') } },
    ret_Variant: { properties: { Sku: prop('String'), ColourCode: prop('String'), Size: prop('String'), Stock: prop('Int'), Prices: prop('[ret_Price]') } },
  },
}
const SEARCHABLE = { ret_Product: new Set(['Name', 'Description']), ret_Category: new Set() }

// ── Load + validate ─────────────────────────────────────────────────────────
const dataFile = `data/catalog/${catalogId}.json`
if (!existsSync(dataFile)) { console.error(`✖ ${dataFile} not found`); process.exit(1) }
const catalog = JSON.parse(readFileSync(dataFile, 'utf8'))

function validate({ products, categories }) {
  const errors = []
  const handles = new Set(), skus = new Set(), catHandles = new Set(categories.map((c) => c.handle))
  for (const c of categories) if (!HANDLE_RE.test(c.handle)) errors.push(`category handle "${c.handle}" is invalid`)
  for (const p of products) {
    const at = `product "${p.handle}"`
    if (!HANDLE_RE.test(p.handle)) errors.push(`${at}: invalid handle`)
    if (handles.has(p.handle)) errors.push(`${at}: duplicate handle`)
    handles.add(p.handle)
    if (!p.name) errors.push(`${at}: missing name`)
    for (const ch of p.categoryHandles) if (!catHandles.has(ch)) errors.push(`${at}: unknown category "${ch}"`)
    const colourCodes = new Set(p.colours.map((c) => c.code))
    for (const v of p.variants) {
      if (skus.has(v.sku)) errors.push(`${at}: duplicate SKU ${v.sku}`)
      skus.add(v.sku)
      if (!colourCodes.has(v.colourCode)) errors.push(`${at}: SKU ${v.sku} references unknown colour ${v.colourCode}`)
      if (!p.sizes.includes(v.size)) errors.push(`${at}: SKU ${v.sku} size ${v.size} not in sizes`)
      for (const cur of CURRENCIES) if (!v.prices.some((pr) => pr.currency === cur)) errors.push(`${at}: SKU ${v.sku} has no ${cur} price`)
      for (const pr of v.prices) if (!Number.isInteger(pr.amount)) errors.push(`${at}: SKU ${v.sku} ${pr.currency} amount must be integer minor units`)
    }
    for (const cur of CURRENCIES) if (!p.fromPrices.some((pr) => pr.currency === cur)) errors.push(`${at}: no ${cur} fromPrice`)
  }
  for (const p of products) for (const h of p.pairsWith ?? []) if (!handles.has(h)) errors.push(`product "${p.handle}": pairsWith unknown "${h}"`)
  for (const p of products) for (const [lang, t] of Object.entries(p.i18n ?? {})) {
    if (!LANGUAGES.includes(lang) || lang === 'en') errors.push(`product "${p.handle}": unsupported i18n language "${lang}"`)
    for (const k of Object.keys(t)) if (!TEXT_FIELDS.includes(k)) errors.push(`product "${p.handle}": i18n.${lang}.${k} is not a translatable field`)
  }
  return errors
}

const errors = validate(catalog)
if (errors.length) {
  console.error(`✖ ${errors.length} validation error(s):\n  - ${errors.slice(0, 30).join('\n  - ')}`)
  process.exit(1)
}
console.log(`✓ valid: ${catalog.products.length} products, ${catalog.products.reduce((n, p) => n + p.variants.length, 0)} SKUs, ${catalog.categories.length} categories`)

// ── Transform (camelCase JSON → PascalCase Graph documents) ─────────────────
const pascal = (k) => k.charAt(0).toUpperCase() + k.slice(1)
function toGraph(value) {
  if (Array.isArray(value)) return value.map(toGraph)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [pascal(k), toGraph(v)]))
  return value
}
function doc(type, obj, language = 'en') {
  const { i18n: _i18n, ...record } = obj // eslint-disable-line no-unused-vars
  const fields = toGraph({ ...record, catalogId })
  const out = {}
  for (const [k, v] of Object.entries(fields)) out[SEARCHABLE[type].has(k) ? `${k}___searchable` : k] = v
  return { ...out, ContentType: [type], Status: 'Published', __typename: type, _rbac: 'r:Everyone:Read', Language: { Name: language } }
}
/** Translated text-only document for `language`, or null when the record has none. */
function textDoc(type, obj, language) {
  const t = obj.i18n?.[language]
  if (!t) return null
  return doc(type, { handle: obj.handle, ...(type === 'ret_Product' ? Object.fromEntries(TEXT_FIELDS.filter((k) => t[k] != null).map((k) => [k, t[k]])) : { name: t.name }) }, language)
}
const docId = (type, handle) => `${type === 'ret_Product' ? 'product' : 'category'}-${catalogId}-${handle}`

// ── Network helpers ─────────────────────────────────────────────────────────
async function send(method, path, body, contentType) {
  const res = await fetch(`${GATEWAY}${path}`, { method, headers: { Authorization: basicAuth(), 'Content-Type': contentType }, body })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 400)}`)
  return text
}
async function postNdjson(lines) {
  for (let i = 0; i < lines.length; i += 200) { // keep request bodies modest
    await send('POST', `/api/content/v2/data?id=${SOURCE_ID}`, lines.slice(i, i + 200).join('\n') + '\n', 'text/plain')
  }
}
async function existingIds() {
  const q = `query($c:String){ ret_Product(locale:[en],where:{CatalogId:{eq:$c}},limit:100){ items{ Handle } } ret_Category(locale:[en],where:{CatalogId:{eq:$c}},limit:100){ items{ Handle } } }`
  const url = `${GATEWAY}/content/v2?query=${encodeURIComponent(q)}&variables=${encodeURIComponent(JSON.stringify({ c: catalogId }))}`
  const res = await fetch(url, { headers: { Authorization: `epi-single ${SINGLE_KEY}` } })
  const json = await res.json().catch(() => ({}))
  if (json.errors?.length) return [] // types not registered yet — nothing to prune
  return [
    ...(json.data?.ret_Product?.items ?? []).map((i) => docId('ret_Product', i.Handle)),
    ...(json.data?.ret_Category?.items ?? []).map((i) => docId('ret_Category', i.Handle)),
  ]
}
const deleteLines = (ids) => ids.flatMap((id) => LANGUAGES.map((lang) => JSON.stringify({ delete: { _id: id, language_routing: lang } })))

// ── Run ─────────────────────────────────────────────────────────────────────
const indexLines = [
  ...catalog.categories.flatMap((c) => [JSON.stringify({ index: { _id: docId('ret_Category', c.handle), language_routing: 'en' } }), JSON.stringify(doc('ret_Category', c))]),
  ...catalog.products.flatMap((p) => [JSON.stringify({ index: { _id: docId('ret_Product', p.handle), language_routing: 'en' } }), JSON.stringify(doc('ret_Product', p))]),
  // Translations: same ids, other language_routing, text fields only.
  ...LANGUAGES.filter((l) => l !== 'en').flatMap((lang) => [
    ...catalog.categories.map((c) => [c, 'ret_Category']), ...catalog.products.map((p) => [p, 'ret_Product']),
  ].flatMap(([obj, type]) => {
    const d = textDoc(type, obj, lang)
    return d ? [JSON.stringify({ index: { _id: docId(type, obj.handle), language_routing: lang } }), JSON.stringify(d)] : []
  })),
]

if (isDryRun) {
  console.log(`  would PUT schema (${Object.keys(SCHEMA.contentTypes).join(', ')}) and POST ${indexLines.length / 2} documents`)
  console.log(`  sample document: ${indexLines[indexLines.length - 1].slice(0, 300)}…`)
  process.exit(0)
}

try {
  if (isReset) {
    const ids = await existingIds()
    if (ids.length) await postNdjson(deleteLines(ids))
    console.log(`✓ reset: deleted ${ids.length} documents from source "${SOURCE_ID}" (catalog ${catalogId})`)
    process.exit(0)
  }
  await send('PUT', `/api/content/v3/types?id=${SOURCE_ID}`, JSON.stringify(SCHEMA), 'application/json')
  console.log(`✓ schema registered on source "${SOURCE_ID}"`)
  if (typesOnly) process.exit(0)

  const wanted = new Set([...catalog.categories.map((c) => docId('ret_Category', c.handle)), ...catalog.products.map((p) => docId('ret_Product', p.handle))])
  const stale = (await existingIds()).filter((id) => !wanted.has(id))
  await postNdjson([...deleteLines(stale), ...indexLines])
  console.log(`✓ pushed ${catalog.categories.length} categories + ${catalog.products.length} products (${indexLines.length / 2} documents across ${LANGUAGES.join('/')})${stale.length ? `, removed ${stale.length} stale` : ''} (indexing takes ~5–10s)`)

  const { CATALOG_REVALIDATE_URL: rvUrl, CATALOG_REVALIDATE_SECRET: rvSecret } = process.env
  if (rvUrl && rvSecret) {
    const res = await fetch(rvUrl, { method: 'POST', headers: { 'x-revalidate-secret': rvSecret } })
    console.log(res.ok ? `✓ revalidated site cache (${rvUrl})` : `! revalidate call failed: HTTP ${res.status}`)
  }
} catch (err) {
  console.error(`✖ ${err.message}`)
  process.exit(1)
}
