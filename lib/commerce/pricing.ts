import { cache } from 'react'
import { resolveVariant } from '@/lib/fx/variant-resolver'
import { getRequestDomain, getRequestLocale, getSiteSettings } from '@/lib/optimizely'
import type { Money, Product } from '@/lib/commerce/types'

/**
 * Price treatment from Feature Experimentation (backlog APP-016…019).
 *
 * The flag `pricing` is decided SERVER-side through the FX SDK already in this
 * repo (lib/fx/variant-resolver.ts → userContext.decide), with the site's SDK
 * key from OT_ThemeManager. Its variables shape every displayed price:
 *
 *   discount_pct     integer 0–90   % off the catalog price
 *   show_compare_at  boolean        show the pre-discount price struck through
 *   price_label      string         short label beside the price ("Reserve price")
 *
 * Delivery rules / experiments in FX decide who gets which values (e.g. an
 * audience on the `loyalty_tier` attribute or an ODP segment, or a markdown A/B
 * test). Flag off, missing, or no SDK key → the catalog price, unchanged.
 * Resolved once per request (React cache) and applied before rendering, so a
 * variant never flickers from the default price on the client.
 */
export const PRICING_FLAG_KEY = 'pricing'

export type PriceTreatment = {
  /** Percentage off the displayed price (0–90). */
  discountPct:   number
  /** Show the pre-discount amount as a compare-at strikethrough. */
  showCompareAt: boolean
  /** Short label shown with treated prices, or null. */
  label:         string | null
}

export const DEFAULT_PRICE_TREATMENT: PriceTreatment = { discountPct: 0, showCompareAt: true, label: null }

const isIdentity = (t: PriceTreatment) => !t.discountPct && t.showCompareAt && !t.label

function fromVariables(v: Record<string, unknown>): PriceTreatment {
  const pct = Number(v.discount_pct)
  const label = typeof v.price_label === 'string' ? v.price_label.trim().slice(0, 40) : ''
  return {
    discountPct:   Number.isFinite(pct) ? Math.min(90, Math.max(0, Math.round(pct))) : 0,
    showCompareAt: v.show_compare_at !== false,
    label:         label || null,
  }
}

export const getPriceTreatment = cache(async (): Promise<PriceTreatment> => {
  try {
    const [domain, locale] = await Promise.all([getRequestDomain(), getRequestLocale()])
    const sdkKey = (await getSiteSettings(domain, locale))?.featureExperimentationSdkKey as string | null | undefined
    if (!sdkKey?.trim()) return DEFAULT_PRICE_TREATMENT
    const decision = await resolveVariant(PRICING_FLAG_KEY, { sdkKey: sdkKey.trim(), locale })
    return decision.enabled ? fromVariables(decision.variables) : DEFAULT_PRICE_TREATMENT
  } catch {
    return DEFAULT_PRICE_TREATMENT
  }
})

export function applyTreatment(price: Money, t: PriceTreatment): Money {
  if (isIdentity(t)) return price
  const label = t.label ?? undefined
  if (!t.discountPct) return { ...price, compareAt: t.showCompareAt ? price.compareAt : null, label }
  // Round to whole units — premium pricing never shows $93.47.
  const amount = Math.round((price.amount * (100 - t.discountPct)) / 100 / 100) * 100
  return { ...price, amount, compareAt: t.showCompareAt ? price.compareAt ?? price.amount : null, label }
}

/**
 * The product with every variant and "from" price treated, so cards, quick add,
 * the PDP and the bag (which snapshots variant prices at add time) all agree.
 */
export function treatProduct(p: Product, t: PriceTreatment): Product {
  if (isIdentity(t)) return p
  const treat = (prices: Money[]) => prices.map((m) => applyTreatment(m, t))
  return { ...p, fromPrices: treat(p.fromPrices), variants: p.variants.map((v) => ({ ...v, prices: treat(v.prices) })) }
}

/** Convenience: resolve the request's treatment and apply it to a list. */
export async function withPricing(products: Product[]): Promise<Product[]> {
  const t = await getPriceTreatment()
  return isIdentity(t) ? products : products.map((p) => treatProduct(p, t))
}
