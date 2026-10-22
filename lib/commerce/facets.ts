import type { ProductCardData } from '@/lib/commerce/card'
import type { CurrencyCode } from '@/lib/commerce/types'

/**
 * PLP facet derivation. Pure and client-safe: the listing computes facet
 * options from the products it loaded, so the same block works for any
 * category, collection or catalog without a fixed facet list.
 */

/** Material families recognised in free-text material lines ("100% boiled loden wool"). */
const MATERIAL_FAMILIES: [RegExp, string][] = [
  [/cashmere/i, 'Cashmere'],
  [/merino/i, 'Merino'],
  [/loden/i, 'Loden'],
  [/lambswool|wool/i, 'Wool'],
  [/silk|satin/i, 'Silk & satin'],
  [/suede|leather|nappa|shearling/i, 'Leather & suede'],
  [/denim|selvedge/i, 'Denim'],
  [/cord/i, 'Corduroy'],
  [/waxed|canvas/i, 'Waxed cotton'],
  [/cotton|poplin|oxford|jersey|flannel|waffle/i, 'Cotton'],
  [/recycled|nylon|polyester|fleece/i, 'Recycled synthetics'],
]

export function materialFamilies(materials: string[]): string[] {
  const text = materials.join(' ')
  const found = new Set<string>()
  for (const [re, label] of MATERIAL_FAMILIES) if (re.test(text)) found.add(label)
  return [...found]
}

export const TRAIT_LABELS: Record<string, string> = {
  'traceable-wool':  'Traceable wool',
  'recycled-fibre':  'Recycled fibre',
  'organic-cotton':  'Organic cotton',
  'repair-eligible': 'Free lifetime repairs',
}

export const FIT_LABELS: Record<string, string> = {
  slim: 'Slim', regular: 'Regular', relaxed: 'Relaxed', oversized: 'Oversized',
}

/** Price bands in major units per currency (lower bound inclusive). */
const BANDS: Record<CurrencyCode, number[]> = {
  USD: [0, 100, 200, 400],
  GBP: [0, 80, 160, 320],
  EUR: [0, 90, 180, 360],
}

export function priceBands(currency: CurrencyCode, format: (minor: number) => string): { key: string; label: string; min: number; max: number }[] {
  const b = BANDS[currency]
  return b.map((lo, i) => {
    const hi = b[i + 1]
    return {
      key:   `p${i}`,
      label: hi == null ? `${format(lo * 100)}+` : i === 0 ? `Under ${format(hi * 100)}` : `${format(lo * 100)}–${format(hi * 100)}`,
      min:   lo * 100,
      max:   hi == null ? Number.POSITIVE_INFINITY : hi * 100,
    }
  })
}

export type SortKey = 'featured' | 'newest' | 'priceAsc' | 'priceDesc' | 'rating'
export const SORT_KEYS: SortKey[] = ['featured', 'newest', 'priceAsc', 'priceDesc', 'rating']

export function sortProducts(list: ProductCardData[], sort: SortKey): ProductCardData[] {
  const out = [...list]
  switch (sort) {
    case 'newest':    return out.sort((a, b) => b.launchedAt.localeCompare(a.launchedAt) || a.sortRank - b.sortRank)
    case 'priceAsc':  return out.sort((a, b) => a.price.amount - b.price.amount)
    case 'priceDesc': return out.sort((a, b) => b.price.amount - a.price.amount)
    case 'rating':    return out.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    default:          return out.sort((a, b) => a.sortRank - b.sortRank)
  }
}
