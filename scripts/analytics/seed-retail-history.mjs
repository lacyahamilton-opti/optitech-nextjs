#!/usr/bin/env node
/**
 * analytics:seed — generates ~12 months of plausible retail history into the
 * retail BigQuery tables (lib/bq/retail-schema.ts), so the Connected Analytics
 * demo (dashboards, the natural-language analytics agent, CLV by segment) has
 * something meaningful to answer. Live mock-checkout orders land in the same
 * tables with source = 'live'.
 *
 * Everything is synthetic and reproducible (seeded PRNG): ~8k customers and
 * ~20k orders over the 48 real catalog products, the five boutique cities,
 * marketing channels, seasonality (Black Friday, the Gift Edit, the Orchard
 * launch), loyalty tiers (new / circle / reserve) with distinct behaviour, and
 * a Black Friday markdown test (control vs 15 % off) on new customers.
 *
 * Usage:
 *   node scripts/analytics/seed-retail-history.mjs [--dry] [--reset] [--customers 8000] [--seed 7]
 *     --dry     generate and print stats + sample rows; no BigQuery calls
 *     --reset   delete existing seed rows (source = 'seed') first
 * Env (.env.local): BQ_SERVICE_ACCOUNT_JSON, BQ_DATASET (default 'demo').
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RETAIL_SCHEMAS, RETAIL_TABLES, COST_RATIO, retailValueViewSql } from '../../lib/bq/retail-schema.ts'

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
const DRY = flag('--dry'), RESET = flag('--reset')
const N_CUSTOMERS = Number(opt('--customers', 8000))
const SEED = Number(opt('--seed', 7))

try { process.loadEnvFile('.env.local') } catch { /* env from shell */ }

// ── Deterministic randomness ─────────────────────────────────────────────────
let s = SEED >>> 0
const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = (weights) => { const total = Object.values(weights).reduce((a, b) => a + b, 0); let r = rand() * total; for (const [k, w] of Object.entries(weights)) { if ((r -= w) <= 0) return k } return Object.keys(weights)[0] }
const poisson = (mean) => { const L = Math.exp(-mean); let k = 0, p = 1; do { k++; p *= rand() } while (p > L); return k - 1 }
const DAY = 86400e3

// ── Inputs ───────────────────────────────────────────────────────────────────
const catalog = JSON.parse(readFileSync('data/catalog/apparel.json', 'utf8'))
const END = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime()
const START = END - 365 * DAY

const CITIES = {
  'New York':    { country: 'United States',  currency: 'USD', w: 22, boutique: true },
  'Los Angeles': { country: 'United States',  currency: 'USD', w: 12, boutique: true },
  'Chicago':     { country: 'United States',  currency: 'USD', w: 9,  boutique: true },
  'Other US':    { country: 'United States',  currency: 'USD', w: 20 },
  'London':      { country: 'United Kingdom', currency: 'GBP', w: 14, boutique: true },
  'Other UK':    { country: 'United Kingdom', currency: 'GBP', w: 6 },
  'Paris':       { country: 'France',         currency: 'EUR', w: 8,  boutique: true },
  'Other EU':    { country: 'Germany',        currency: 'EUR', w: 9 },
}
const ACQ = { organic: 28, paid_search: 22, paid_social: 18, direct: 12, email: 6, ai_referral: 8, referral: 6 }
const REPEAT_CHANNEL = { email: 34, direct: 30, organic: 18, paid_social: 7, ai_referral: 7, paid_search: 4 }
const SOURCE_FOR = { organic: 'google', paid_search: 'google', paid_social: 'instagram', direct: null, email: 'newsletter', ai_referral: 'chatgpt.com', referral: 'vogue.com' }
const MEDIUM_FOR = { organic: 'organic', paid_search: 'cpc', paid_social: 'paid_social', direct: null, email: 'email', ai_referral: 'referral', referral: 'referral' }
const CAMPAIGNS = { paid_search: ['brand', 'coats-generic', 'cashmere-generic'], paid_social: ['orchard-aw26', 'gift-edit', 'circle-launch'], email: ['orchard-part-ii', 'gift-edit', 'circle-early-access', 'archive'] }
const TIERS = { new: 70, circle: 25, reserve: 5 }
// Orders per customer over the year, by tier (mean; at least one).
const ORDER_MEAN = { new: 1.3, circle: 6, reserve: 14 }

// Seasonality by month (0 = Jan) and special windows.
const MONTH_W = [0.8, 0.7, 0.85, 0.9, 0.9, 0.8, 0.7, 0.8, 1.25, 1.15, 1.7, 1.55]
function dayWeight(t) {
  const d = new Date(t), m = d.getUTCMonth(), dd = d.getUTCDate()
  let w = MONTH_W[m]
  if (m === 10 && dd >= 24) w *= 2.4 // Black Friday → Cyber Monday
  if (m === 11 && dd >= 1 && dd <= 17) w *= 1.4 // Gift Edit, before last standard order
  if (m === 8 && dd >= 14) w *= 1.5 // Orchard launch (14 Sep)
  if (m === 9 && dd >= 8 && dd <= 11) w *= 1.8 // Orchard Part II drop
  return w
}
const DAYS = Array.from({ length: 365 }, (_, i) => START + i * DAY)
const DAY_W = DAYS.map(dayWeight)
const DAY_TOTAL = DAY_W.reduce((a, b) => a + b, 0)
function randomDay(from = START) {
  let r = rand() * DAY_TOTAL
  for (let i = 0; i < DAYS.length; i++) { if ((r -= DAY_W[i]) <= 0) return Math.max(DAYS[i], from) }
  return DAYS[DAYS.length - 1]
}
const at = (day) => new Date(day + Math.floor((8 + rand() * 14) * 3600e3)).toISOString() // 08:00–22:00

// Product popularity by season.
const top = (p) => p.primaryCategory.split('-')[0]
function productWeight(p, t) {
  const m = new Date(t).getUTCMonth()
  const cold = [9, 10, 11, 0, 1].includes(m)
  let w = 1 + (p.badges.includes('bestseller') ? 1.5 : 0) + (p.badges.includes('signature') ? 0.6 : 0) + p.reviewCount / 400
  if (/coats|knitwear|scarves|gloves/.test(p.primaryCategory)) w *= cold ? 2.2 : 0.5
  if (/jersey|shirts|tops/.test(p.primaryCategory)) w *= cold ? 0.7 : 1.6
  if (p.collections.includes('gift-edit') && m === 11) w *= 2.5
  if (p.collections.includes('low-light-aw26') && (m === 8 || m === 9)) w *= 2
  if (p.collections.includes('archive')) w *= 0.6
  return w
}

// ── Generate ─────────────────────────────────────────────────────────────────
const customers = [], orders = [], lines = []
let orderSeq = 0
for (let i = 1; i <= N_CUSTOMERS; i++) {
  const id = `c-${String(i).padStart(5, '0')}`
  const tier = pick(TIERS)
  const city = pick(Object.fromEntries(Object.entries(CITIES).map(([k, v]) => [k, v.w])))
  const { country, currency, boutique } = CITIES[city]
  const channel = pick(ACQ)
  const campaign = CAMPAIGNS[channel] ? CAMPAIGNS[channel][Math.floor(rand() * CAMPAIGNS[channel].length)] : null
  const firstDay = randomDay()
  customers.push({
    customer_id: id, loyalty_tier: tier, home_city: city, home_country: country,
    acquisition_channel: channel, acquisition_source: SOURCE_FOR[channel], acquisition_campaign: campaign,
    first_seen_at: at(firstDay), created_at: at(firstDay), source: 'seed',
  })

  const n = Math.max(1, poisson(ORDER_MEAN[tier]))
  let day = firstDay
  for (let k = 0; k < n; k++) {
    if (k > 0) day += Math.floor(7 + rand() * (tier === 'reserve' ? 28 : 55)) * DAY
    if (day >= END) break // the rest of this customer's orders fall after today
    const placed = at(day)
    const ch = k === 0 ? channel : pick(REPEAT_CHANNEL)
    const m = new Date(day).getUTCMonth(), dd = new Date(day).getUTCDate()
    const blackFriday = m === 10 && dd >= 24
    // Black Friday markdown test on new customers: control vs 15 % off (FX flag `pricing`).
    const variation = blackFriday && tier === 'new' ? (rand() < 0.5 ? 'bf_15' : 'bf_control') : (tier === 'reserve' && rand() < 0.4 ? 'reserve_price' : null)
    const pct = variation === 'bf_15' ? 15 : variation === 'reserve_price' ? 10 : 0
    const itemCount = pick({ 1: 52, 2: 30, 3: 13, 4: 5 }) * 1 + (tier === 'reserve' && rand() < 0.3 ? 1 : 0)
    const orderId = `AI-S${(++orderSeq).toString(36).toUpperCase().padStart(6, '0')}`
    let subtotal = 0, discount = 0, qtyTotal = 0
    const pool = catalog.products.map((p) => [p, productWeight(p, day)])
    const poolTotal = pool.reduce((a, [, w]) => a + w, 0)
    const chosen = new Set()
    for (let j = 0; j < itemCount; j++) {
      let r = rand() * poolTotal, p = pool[0][0]
      for (const [cand, w] of pool) { if ((r -= w) <= 0) { p = cand; break } }
      if (chosen.has(p.handle)) continue
      chosen.add(p.handle)
      const inStock = p.variants.filter((v) => v.stock > 0)
      const v = (inStock.length ? inStock : p.variants)[Math.floor(rand() * (inStock.length || p.variants.length))]
      const price = v.prices.find((x) => x.currency === currency)
      const list = price.amount / 100
      const unit = pct ? Math.round(list * (100 - pct) / 100) : list
      const qty = rand() < 0.93 ? 1 : 2
      const cost = Math.round(list * (COST_RATIO[top(p)] ?? 0.4) * 100) / 100
      subtotal += unit * qty; discount += (list - unit) * qty; qtyTotal += qty
      lines.push({
        order_id: orderId, customer_id: id, placed_at: placed, sku: v.sku, product_id: p.handle, product_name: p.name,
        category: p.primaryCategory, gender: p.gender, collection: p.collections[0] ?? null, size: v.size,
        colour: p.colours.find((c) => c.code === v.colourCode)?.name ?? v.colourCode, quantity: qty,
        unit_price: unit, line_total: unit * qty, unit_cost: cost, margin: Math.round((unit * qty - cost * qty) * 100) / 100,
        currency, source: 'seed',
      })
    }
    const delivery = boutique ? pick({ standard: 62, express: 16, collect: 22 }) : pick({ standard: 80, express: 20 })
    const shipping = delivery === 'collect' || (delivery === 'standard' && subtotal >= 250) ? 0 : delivery === 'express' ? 25 : 10
    orders.push({
      order_id: orderId, customer_id: id, placed_at: placed, currency,
      subtotal: Math.round(subtotal * 100) / 100, discount: Math.round(discount * 100) / 100, shipping,
      total: Math.round((subtotal + shipping) * 100) / 100, item_count: qtyTotal, delivery,
      store_city: delivery === 'collect' ? city : null, channel: ch,
      utm_source: SOURCE_FOR[ch], utm_medium: MEDIUM_FOR[ch],
      utm_campaign: CAMPAIGNS[ch] ? CAMPAIGNS[ch][Math.floor(rand() * CAMPAIGNS[ch].length)] : null,
      device: pick({ mobile: 61, desktop: 34, tablet: 5 }), loyalty_tier: tier, price_treatment: variation, source: 'seed',
    })
  }
}

const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0)
console.log(`› generated ${customers.length} customers, ${orders.length} orders, ${lines.length} lines`)
console.log(`  revenue (mixed currencies, major units): ${Math.round(sum(orders, 'total')).toLocaleString()}; AOV ${Math.round(sum(orders, 'total') / orders.length)}`)
for (const t of Object.keys(TIERS)) {
  const o = orders.filter((r) => r.loyalty_tier === t)
  console.log(`  ${t.padEnd(8)} customers ${customers.filter((c) => c.loyalty_tier === t).length}, orders ${o.length}, AOV ${Math.round(sum(o, 'total') / Math.max(1, o.length))}`)
}
if (DRY) {
  console.log('  sample order:', JSON.stringify(orders[orders.length - 1]))
  console.log('  sample line: ', JSON.stringify(lines[lines.length - 1]))
  process.exit(0)
}

// ── Load into BigQuery ───────────────────────────────────────────────────────
const { BigQuery } = await import('@google-cloud/bigquery')
const creds = JSON.parse(process.env.BQ_SERVICE_ACCOUNT_JSON ?? 'null')
if (!creds?.project_id) { console.error('✖ BQ_SERVICE_ACCOUNT_JSON is not set'); process.exit(1) }
const datasetId = process.env.BQ_DATASET || 'demo'
const bq = new BigQuery({ projectId: creds.project_id, credentials: { client_email: creds.client_email, private_key: creds.private_key } })
const ds = bq.dataset(datasetId)
const fq = (t) => `\`${creds.project_id}.${datasetId}.${t}\``

for (const [key, name] of Object.entries(RETAIL_TABLES)) {
  const [exists] = await ds.table(name).exists()
  if (exists) continue
  const sch = RETAIL_SCHEMAS[key]
  await ds.createTable(name, { schema: { fields: sch.fields }, timePartitioning: { type: 'DAY', field: sch.partitionField }, clustering: { fields: sch.clustering } })
  console.log(`✓ created ${name}`)
}
await bq.query({ query: retailValueViewSql(creds.project_id, datasetId) })

const [[{ n }]] = await bq.query({ query: `SELECT COUNT(*) AS n FROM ${fq(RETAIL_TABLES.orders)} WHERE source = 'seed'` })
if (n > 0 && !RESET) { console.error(`✖ ${n} seed orders already exist — rerun with --reset to replace them`); process.exit(1) }
if (RESET) {
  for (const name of Object.values(RETAIL_TABLES)) await bq.query({ query: `DELETE FROM ${fq(name)} WHERE source = 'seed'` })
  console.log('✓ removed previous seed rows')
}

const dir = mkdtempSync(join(tmpdir(), 'retail-seed-'))
for (const [name, rows] of [[RETAIL_TABLES.customers, customers], [RETAIL_TABLES.orders, orders], [RETAIL_TABLES.lines, lines]]) {
  const file = join(dir, `${name}.ndjson`)
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  // Load jobs (not streaming) — streaming can't write partitions older than ~31 days.
  await ds.table(name).load(file, { sourceFormat: 'NEWLINE_DELIMITED_JSON', writeDisposition: 'WRITE_APPEND' })
  console.log(`✓ loaded ${rows.length} rows into ${name}`)
}
console.log(`✓ done — query ${fq('retail_customer_value')} for CLV by tier / channel`)
