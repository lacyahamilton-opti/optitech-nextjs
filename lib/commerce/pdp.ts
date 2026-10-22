import 'server-only'
import { cache } from 'react'
import { getClient, getLocalizedContentByPath } from '@/lib/optimizely'
import { getProductByHandle, getProducts, isValidHandle } from '@/lib/catalog'
import { getPriceTreatment, treatProduct } from '@/lib/commerce/pricing'
import { resolveContentVariant } from '@/lib/fx'
import { sanitizeCmsHtml } from '@/lib/sanitizeHtml'
import type { Product } from '@/lib/commerce/types'
import type { Locale } from '@/lib/i18n/config'

/**
 * Product detail page resolution.
 *
 * /products/<handle> is NOT a Next.js route — the OptiTech site already owns
 * CMS pages under /products/*, and a static route would shadow them. Instead
 * the catch-all slug route calls resolvePdp() only after the CMS path lookup
 * found nothing, and only on hosts with commerce enabled. A CMS page therefore
 * always wins over a catalog product at the same path.
 */
const PDP_PATH = /^\/products\/([a-z0-9][a-z0-9-]{0,79})\/?$/

/** The product handle if `path` (already locale-stripped) is a PDP path. */
export function matchPdpPath(path: string): string | null {
  const m = path.match(PDP_PATH)
  return m && isValidHandle(m[1]) ? m[1] : null
}

type TemplateRow = { key: string; url: string | null; appliesTo: string | null }

const TEMPLATES_QUERY = `
  query ProductDetailTemplates($base: String) {
    OT_ProductDetailTemplate(where: { _metadata: { url: { base: { eq: $base } } } }, limit: 50) {
      items { _metadata { key url { default } } appliesTo }
    }
  }
`

const listTemplates = cache(async (baseUrl: string): Promise<TemplateRow[]> => {
  try {
    const data = await getClient().request(TEMPLATES_QUERY, { base: baseUrl })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = ((data as any)?.OT_ProductDetailTemplate?.items ?? []) as any[]
    return items.map((i) => ({ key: i._metadata?.key, url: i._metadata?.url?.default ?? null, appliesTo: i.appliesTo ?? null }))
      .filter((t) => t.key)
  } catch {
    return [] // type not pushed yet / Graph lag — PDP still renders its locked header
  }
})

/** Most specific template for `product`: exact handle → category → default (blank). */
const targetsOf = (t: TemplateRow) => (t.appliesTo ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

/** Templates that apply to `product`, most specific first: handle → category → default. */
export function rankTemplates(templates: TemplateRow[], product: Product): TemplateRow[] {
  const byHandle   = templates.filter((t) => targetsOf(t).includes(product.handle))
  const byCategory = templates.filter((t) => !byHandle.includes(t) && targetsOf(t).some((x) => x.startsWith('category:') && product.categoryHandles.includes(x.slice(9))))
  const fallback   = templates.filter((t) => targetsOf(t).length === 0)
  return [...byHandle, ...byCategory, ...fallback]
}

/** The most specific template for `product`, or null. */
export function pickTemplate(templates: TemplateRow[], product: Product): TemplateRow | null {
  return rankTemplates(templates, product)[0] ?? null
}

/** Path part of a Graph URL (absolute or relative). */
function pathOf(url: string | null): string | null {
  if (!url) return null
  try { return new URL(url, 'http://x').pathname } catch { return null }
}

/**
 * Loads a template experience (with composition) by its own URL, so locale
 * fallback and FX content variations work exactly as they do for any page.
 */
async function loadTemplate(row: TemplateRow, locale: Locale, baseUrl: string, fxSdkKey?: string | null) {
  const path = pathOf(row.url)
  if (!path) return null
  let exp = await getLocalizedContentByPath(path, locale, baseUrl)
  if (exp?.FxFlagKey) {
    const decision = await resolveContentVariant({ flagKey: exp.FxFlagKey, sdkKey: fxSdkKey, locale })
    if (decision.contentVariation) {
      const variant = await getLocalizedContentByPath(path, locale, baseUrl, decision.contentVariation)
      if (variant?.composition?.nodes) exp = variant
    }
  }
  return exp ?? null
}

export type ResolvedPdp = {
  product:  Product
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  template: any | null
}

export const resolvePdp = cache(async (
  handle: string,
  catalogId: string,
  locale: Locale,
  baseUrl: string,
  fxSdkKey?: string | null,
): Promise<ResolvedPdp | null> => {
  const raw = await getProductByHandle(catalogId, handle)
  if (!raw) return null
  let product = treatProduct(raw, await getPriceTreatment())

  // Walk the matching templates, most specific first. A handle-scoped template
  // may carry only a Product Description (e.g. agent-written copy, APP-013) and
  // no composition — its description still applies, and the layout falls
  // through to the category / default template.
  let template = null
  for (const row of rankTemplates(await listTemplates(baseUrl), product)) {
    const exp = await loadTemplate(row, locale, baseUrl, fxSdkKey)
    if (!exp) continue
    // Only in the language it was written in — a locale fallback to English
    // must not replace the translated catalog description.
    const sameLocale = !exp._metadata?.locale || exp._metadata.locale === locale
    const html = sameLocale && targetsOf(row).includes(product.handle) ? sanitizeCmsHtml(exp.productDescription?.html) : ''
    if (html && !product.descriptionHtml) {
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      product = { ...product, descriptionHtml: html, description: text || product.description }
    }
    if (exp.composition?.nodes?.length) { template = exp; break }
  }
  return { product, template }
})

/** Product shown in the locked header while editing a template in Visual Builder. */
export async function previewProductFor(catalogId: string, previewHandle?: string | null): Promise<Product | null> {
  if (previewHandle && isValidHandle(previewHandle.trim())) {
    const p = await getProductByHandle(catalogId, previewHandle.trim())
    if (p) return p
  }
  return (await getProducts(catalogId))[0] ?? null
}
