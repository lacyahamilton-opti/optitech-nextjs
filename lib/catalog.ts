import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { cache } from 'react'
import { getRequestLocale } from '@/lib/optimizely'
import type { Category, Colour, CurrencyCode, Money, Product, ProductGender, Variant } from '@/lib/commerce/types'

/**
 * Product catalog reader.
 *
 * The catalog is NOT CMS content — it lives in an Optimizely Graph external
 * content source (id `ret`, types `ret_Product` / `ret_Category`), seeded by
 * scripts/catalog/push-catalog.mjs and, later, by an OCP app (backlog
 * APP-002/003). Pages query it alongside CMS content through the same Graph
 * single key, which is the "one graph over CMS + commerce data" demo story.
 *
 * Two providers sit behind one interface:
 *   - `graph` (default) — cached Graph GET queries, tagged `catalog` so
 *     /api/revalidate/catalog can bust them after a re-push.
 *   - `local` — reads the catalog's seed file, data/catalog/<catalogId>.json
 *     (loaded lazily, per catalog — no site's data is bundled in). Selected with
 *     CATALOG_SOURCE=local, and used automatically as a fallback if a Graph
 *     read fails, so the demo never renders an empty store.
 *
 * The whole catalog is small (48 products), so every read loads the full
 * catalog once per request (React cache + fetch cache) and filters in memory.
 *
 * Localization: English documents carry everything; fr / de / es documents
 * (same ids, other `language_routing`) carry only the translated text — name,
 * description, fit notes, materials, care, category names — which is laid over
 * the English catalog. Anything untranslated stays English. The locale is the
 * request's (next-intl) or, in route handlers outside the proxy, the one set
 * with withCatalogLocale().
 */

const GRAPH_URL = 'https://cg.optimizely.com/content/v2'
const REVALIDATE_SECONDS = 300
export const CATALOG_CACHE_TAG = 'catalog'

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{0,79}$/

/** Locales with translated catalog text (English is the base). */
const TRANSLATED_LOCALES = new Set(['fr', 'de', 'es'])

const localeStore = new AsyncLocalStorage<string>()

/** Run `fn` with catalog reads localized to `locale` (route handlers pass the client's locale). */
export function withCatalogLocale<T>(locale: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  return locale && (locale === 'en' || TRANSLATED_LOCALES.has(locale)) ? localeStore.run(locale, fn) : fn()
}

async function activeLocale(): Promise<string> {
  const stored = localeStore.getStore()
  if (stored) return stored
  try { return await getRequestLocale() } catch { return 'en' }
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_RE.test(handle)
}

// ─── Graph provider ────────────────────────────────────────────────────────────

const PRICE_FIELDS = 'Currency Amount CompareAt'

const PRODUCT_FIELDS = `
  Handle StyleId CatalogId Brand Name Description Gender PrimaryCategory
  CategoryHandles Collections Badges Materials Care Fit FitNotes Traits
  Rating ReviewCount SortRank LaunchedAt Url Sizes PairsWith
  Colours { Code Name Hex Images }
  Variants { Sku ColourCode Size Stock Prices { ${PRICE_FIELDS} } }
  FromPrices { ${PRICE_FIELDS} }
`

const PRODUCTS_QUERY = `
  query CatalogProducts($catalogId: String, $cursor: String) {
    ret_Product(locale: [en], where: { CatalogId: { eq: $catalogId } }, limit: 100, cursor: $cursor) {
      cursor
      items { ${PRODUCT_FIELDS} }
    }
  }
`

const CATEGORIES_QUERY = `
  query CatalogCategories($catalogId: String) {
    ret_Category(locale: [en], where: { CatalogId: { eq: $catalogId } }, limit: 100) {
      items { Handle Name ParentHandle Gender Url SortRank }
    }
  }
`

type GraphResponse<T> = { data?: T; errors?: { message: string }[] }

async function graphGet<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = process.env.OPTIMIZELY_GRAPH_SINGLE_KEY
  if (!key) throw new Error('OPTIMIZELY_GRAPH_SINGLE_KEY is not set')
  // GET (not POST) so Next's fetch cache stores the response under the tag.
  const url = `${GRAPH_URL}?query=${encodeURIComponent(query)}&variables=${encodeURIComponent(JSON.stringify(variables))}`
  const res = await fetch(url, {
    headers: { Authorization: `epi-single ${key}` },
    next: { revalidate: REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
  })
  if (!res.ok) throw new Error(`Catalog Graph request failed: HTTP ${res.status}`)
  const json = (await res.json()) as GraphResponse<T>
  if (json.errors?.length) throw new Error(`Catalog Graph error: ${json.errors[0].message}`)
  if (!json.data) throw new Error('Catalog Graph returned no data')
  return json.data
}

// Catalog images are stored as instance-relative DAM paths (/globalassets/…)
// so one dataset works on every CMS instance; resolve them against the CMS host.
const CMS_ORIGIN = (process.env.OPTIMIZELY_CMS_URL ?? '').replace(/\/+$/, '')
const resolveImage = (src: string): string => (src.startsWith('/') && CMS_ORIGIN ? CMS_ORIGIN + src : src)
const resolveColours = (colours: Colour[]): Colour[] => colours.map((c) => ({ ...c, images: c.images.map(resolveImage) }))

/* eslint-disable @typescript-eslint/no-explicit-any */
const toMoney = (p: any): Money => ({
  currency:  p.Currency as CurrencyCode,
  amount:    Number(p.Amount) || 0,
  compareAt: p.CompareAt == null ? null : Number(p.CompareAt),
})

function fromGraphProduct(p: any): Product {
  return {
    handle:          p.Handle,
    styleId:         p.StyleId ?? '',
    catalogId:       p.CatalogId,
    brand:           p.Brand ?? '',
    name:            p.Name ?? '',
    description:     p.Description ?? '',
    gender:          (p.Gender ?? 'unisex') as ProductGender,
    primaryCategory: p.PrimaryCategory ?? '',
    categoryHandles: p.CategoryHandles ?? [],
    collections:     p.Collections ?? [],
    badges:          p.Badges ?? [],
    materials:       p.Materials ?? [],
    care:            p.Care ?? [],
    fit:             p.Fit ?? null,
    fitNotes:        p.FitNotes ?? '',
    traits:          p.Traits ?? [],
    rating:          Number(p.Rating) || 0,
    reviewCount:     Number(p.ReviewCount) || 0,
    sortRank:        Number(p.SortRank) || 0,
    launchedAt:      p.LaunchedAt ?? '',
    url:             p.Url ?? `/products/${p.Handle}`,
    colours:         resolveColours((p.Colours ?? []).map((c: any): Colour => ({ code: c.Code, name: c.Name, hex: c.Hex, images: c.Images ?? [] }))),
    sizes:           p.Sizes ?? [],
    variants:        (p.Variants ?? []).map((v: any): Variant => ({
      sku: v.Sku, colourCode: v.ColourCode, size: v.Size, stock: Number(v.Stock) || 0, prices: (v.Prices ?? []).map(toMoney),
    })),
    fromPrices:      (p.FromPrices ?? []).map(toMoney),
    pairsWith:       p.PairsWith ?? [],
  }
}

const fromGraphCategory = (c: any): Category => ({
  handle: c.Handle, name: c.Name, parentHandle: c.ParentHandle ?? null,
  gender: (c.Gender ?? 'unisex') as ProductGender, url: c.Url, sortRank: Number(c.SortRank) || 0,
})
/* eslint-enable @typescript-eslint/no-explicit-any */

async function graphProducts(catalogId: string): Promise<Product[]> {
  const out: Product[] = []
  let cursor = ''
  // Graph caps a page at 100; follow the cursor (bounded) for larger catalogs.
  for (let page = 0; page < 10; page++) {
    const data = await graphGet<{ ret_Product: { cursor?: string; items: unknown[] } }>(PRODUCTS_QUERY, { catalogId, cursor })
    const items = data.ret_Product?.items ?? []
    out.push(...items.map(fromGraphProduct))
    if (items.length < 100 || !data.ret_Product.cursor) break
    cursor = data.ret_Product.cursor
  }
  return out
}

async function graphCategories(catalogId: string): Promise<Category[]> {
  const data = await graphGet<{ ret_Category: { items: unknown[] } }>(CATEGORIES_QUERY, { catalogId })
  return (data.ret_Category?.items ?? []).map(fromGraphCategory)
}

// ─── Local provider ────────────────────────────────────────────────────────────

type SeedText = { name?: string; description?: string; fitNotes?: string; materials?: string[]; care?: string[] }
/** Seed file shape: catalog records plus optional per-locale text (`i18n`). */
type SeedProduct = Product & { i18n?: Record<string, SeedText> }
type SeedCategory = Category & { i18n?: Record<string, { name?: string }> }
type LocalCatalog = { catalogId: string; categories: SeedCategory[]; products: SeedProduct[] }
const EMPTY_CATALOG: LocalCatalog = { catalogId: '', categories: [], products: [] }

const loadLocal = cache(async (catalogId: string): Promise<LocalCatalog> => {
  if (!isValidHandle(catalogId)) return EMPTY_CATALOG
  try {
    const raw = ((await import(`../data/catalog/${catalogId}.json`)) as { default: LocalCatalog }).default
    if (raw.catalogId !== catalogId) return EMPTY_CATALOG
    return { ...raw, products: raw.products.map((p) => ({ ...p, colours: resolveColours(p.colours) })) }
  } catch {
    return EMPTY_CATALOG // no seed file for this catalog
  }
})

// Seed `i18n` blocks feed the translation overlay only — never the product objects.
const localProducts   = async (catalogId: string): Promise<Product[]> =>
  (await loadLocal(catalogId)).products.map(({ i18n: _i18n, ...p }) => p) // eslint-disable-line @typescript-eslint/no-unused-vars
const localCategories = async (catalogId: string): Promise<Category[]> =>
  (await loadLocal(catalogId)).categories.map(({ i18n: _i18n, ...c }) => c) // eslint-disable-line @typescript-eslint/no-unused-vars

// ─── Translations (overlay on the English catalog) ─────────────────────────────

type ProductText = SeedText
type Overlay = { products: Map<string, ProductText>; categories: Map<string, string> }
const EMPTY_OVERLAY: Overlay = { products: new Map(), categories: new Map() }

// Locale is an enum literal in Graph; only TRANSLATED_LOCALES values reach here.
const OVERLAY_QUERY = (locale: string) => `
  query CatalogText($catalogId: String) {
    ret_Product(locale: [${locale}], where: { CatalogId: { eq: $catalogId } }, limit: 100) {
      items { Handle Name Description FitNotes Materials Care }
    }
    ret_Category(locale: [${locale}], where: { CatalogId: { eq: $catalogId } }, limit: 100) {
      items { Handle Name }
    }
  }
`

/* eslint-disable @typescript-eslint/no-explicit-any */
async function graphOverlay(catalogId: string, locale: string): Promise<Overlay> {
  const data = await graphGet<{ ret_Product: { items: any[] }; ret_Category: { items: any[] } }>(OVERLAY_QUERY(locale), { catalogId })
  return {
    products: new Map(data.ret_Product.items.map((p) => [p.Handle, {
      name: p.Name ?? undefined, description: p.Description ?? undefined, fitNotes: p.FitNotes ?? undefined,
      materials: p.Materials ?? undefined, care: p.Care ?? undefined,
    }])),
    categories: new Map(data.ret_Category.items.filter((c) => c.Name).map((c) => [c.Handle, c.Name])),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function localOverlay(catalogId: string, locale: string): Promise<Overlay> {
  const raw = await loadLocal(catalogId)
  return {
    products: new Map(raw.products.filter((p) => p.i18n?.[locale]).map((p) => [p.handle, p.i18n![locale]])),
    categories: new Map(raw.categories.filter((c) => c.i18n?.[locale]?.name).map((c) => [c.handle, c.i18n![locale].name!])),
  }
}

const loadOverlay = cache(async (catalogId: string, locale: string): Promise<Overlay> => {
  if (!TRANSLATED_LOCALES.has(locale)) return EMPTY_OVERLAY
  if (!useLocal()) {
    try {
      const overlay = await graphOverlay(catalogId, locale)
      if (overlay.products.size) return overlay
    } catch (err) {
      console.warn(`[catalog] Graph ${locale} text read failed — using seed translations: ${(err as Error).message}`)
    }
  }
  return localOverlay(catalogId, locale)
})

const pick = <T,>(t: T | undefined, base: T): T => (t === undefined || t === null || (Array.isArray(t) && !t.length) || t === '' ? base : t)

function localizeProduct(p: Product, t: ProductText | undefined): Product {
  if (!t) return p
  return {
    ...p,
    name:        pick(t.name, p.name),
    description: pick(t.description, p.description),
    fitNotes:    pick(t.fitNotes, p.fitNotes),
    materials:   pick(t.materials, p.materials),
    care:        pick(t.care, p.care),
  }
}

// ─── Provider selection (per request) ──────────────────────────────────────────

const useLocal = () => process.env.CATALOG_SOURCE === 'local'

const loadBaseProducts = cache(async (catalogId: string): Promise<Product[]> => {
  if (useLocal()) return localProducts(catalogId)
  try {
    const products = await graphProducts(catalogId)
    if (products.length) return products
    console.warn(`[catalog] Graph returned 0 products for "${catalogId}" — using local catalog`)
  } catch (err) {
    console.warn(`[catalog] Graph read failed — using local catalog: ${(err as Error).message}`)
  }
  return localProducts(catalogId)
})

const loadBaseCategories = cache(async (catalogId: string): Promise<Category[]> => {
  if (useLocal()) return localCategories(catalogId)
  try {
    const categories = await graphCategories(catalogId)
    if (categories.length) return categories
  } catch (err) {
    console.warn(`[catalog] Graph category read failed — using local catalog: ${(err as Error).message}`)
  }
  return localCategories(catalogId)
})

const loadLocalizedProducts = cache(async (catalogId: string, locale: string): Promise<Product[]> => {
  const base = await loadBaseProducts(catalogId)
  const overlay = await loadOverlay(catalogId, locale)
  return overlay.products.size ? base.map((p) => localizeProduct(p, overlay.products.get(p.handle))) : base
})

const loadLocalizedCategories = cache(async (catalogId: string, locale: string): Promise<Category[]> => {
  const base = await loadBaseCategories(catalogId)
  const overlay = await loadOverlay(catalogId, locale)
  return overlay.categories.size ? base.map((c) => ({ ...c, name: overlay.categories.get(c.handle) ?? c.name })) : base
})

const loadProducts   = async (catalogId: string) => loadLocalizedProducts(catalogId, await activeLocale())
const loadCategories = async (catalogId: string) => loadLocalizedCategories(catalogId, await activeLocale())

// ─── Public API ────────────────────────────────────────────────────────────────

export type ProductQuery = {
  category?:   string
  gender?:     ProductGender
  collection?: string
  badge?:      string
}

export async function getProducts(catalogId: string, q: ProductQuery = {}): Promise<Product[]> {
  const all = await loadProducts(catalogId)
  return all
    .filter((p) =>
      (!q.category   || p.categoryHandles.includes(q.category)) &&
      (!q.gender     || p.gender === q.gender) &&
      (!q.collection || p.collections.includes(q.collection)) &&
      (!q.badge      || p.badges.includes(q.badge)))
    .sort((a, b) => a.sortRank - b.sortRank)
}

export async function getProductByHandle(catalogId: string, handle: string): Promise<Product | null> {
  if (!isValidHandle(handle)) return null
  const all = await loadProducts(catalogId)
  return all.find((p) => p.handle === handle) ?? null
}

/** Returns products in the order of `handles`, skipping unknown/invalid ones. */
export async function getProductsByHandles(catalogId: string, handles: string[]): Promise<Product[]> {
  const all = await loadProducts(catalogId)
  const byHandle = new Map(all.map((p) => [p.handle, p]))
  return handles.filter(isValidHandle).map((h) => byHandle.get(h)).filter((p): p is Product => !!p)
}

export async function getCategories(catalogId: string): Promise<Category[]> {
  const cats = await loadCategories(catalogId)
  return [...cats].sort((a, b) => a.sortRank - b.sortRank)
}

export async function getCategory(catalogId: string, handle: string): Promise<Category | null> {
  return (await getCategories(catalogId)).find((c) => c.handle === handle) ?? null
}

/**
 * Related products for "complete the look": the product's curated pairings
 * first, then same-category items, excluding the product and `exclude`.
 */
export async function getRelated(catalogId: string, product: Product, n = 4, exclude: string[] = []): Promise<Product[]> {
  const skip = new Set([product.handle, ...exclude])
  const paired = (await getProductsByHandles(catalogId, product.pairsWith)).filter((p) => !skip.has(p.handle))
  paired.forEach((p) => skip.add(p.handle))
  const sameCategory = (await getProducts(catalogId, { category: product.primaryCategory }))
    .filter((p) => !skip.has(p.handle) && !p.badges.includes('archive'))
  return [...paired, ...sameCategory].slice(0, n)
}

export async function getAllHandles(catalogId: string): Promise<string[]> {
  return (await loadProducts(catalogId)).map((p) => p.handle)
}

// ─── Search ────────────────────────────────────────────────────────────────────

const SEARCH_QUERY = (semantic: boolean, locale: string) => `
  query CatalogSearch($catalogId: String, $q: String, $limit: Int) {
    ret_Product(
      locale: [${locale}]
      where: { CatalogId: { eq: $catalogId }, _fulltext: { match: $q${semantic ? '' : ', fuzzy: true'} } }
      orderBy: { _ranking: ${semantic ? 'SEMANTIC' : 'RELEVANCE'} }
      limit: $limit
    ) {
      items { Handle }
    }
  }
`

/**
 * Full-text product search (site search, C4). Graph ranks the matches on the
 * searchable Name/Description fields (semantic when asked); the full products
 * then come from the same cached catalog as every other read. Falls back to a
 * simple term match over the local catalog when Graph is unavailable.
 */
export async function searchProducts(catalogId: string, q: string, opts: { semantic?: boolean; limit?: number } = {}): Promise<Product[]> {
  const term = q.trim().slice(0, 100)
  const limit = Math.min(opts.limit ?? 8, 24)
  if (term.length < 2 || !isValidHandle(catalogId)) return []
  if (process.env.CATALOG_SOURCE !== 'local') {
    try {
      // Search the shopper's language (its documents hold the translated name and
      // description); English when that locale has no translations.
      const locale = await activeLocale()
      const data = await graphGet<{ ret_Product: { items: { Handle: string }[] } }>(
        SEARCH_QUERY(!!opts.semantic, TRANSLATED_LOCALES.has(locale) ? locale : 'en'), { catalogId, q: term, limit },
      )
      return getProductsByHandles(catalogId, data.ret_Product.items.map((i) => i.Handle))
    } catch (err) {
      console.warn(`[catalog] Graph search failed — matching locally: ${(err as Error).message}`)
    }
  }
  const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 1)
  const score = (p: Product) => {
    const hay = `${p.name} ${p.description} ${p.materials.join(' ')} ${p.primaryCategory}`.toLowerCase()
    return words.reduce((n, w) => n + (hay.includes(w) ? (p.name.toLowerCase().includes(w) ? 3 : 1) : 0), 0)
  }
  return (await loadProducts(catalogId))
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.sortRank - b.p.sortRank)
    .slice(0, limit)
    .map((x) => x.p)
}
