import type { CurrencyCode, Money, Product } from '@/lib/commerce/types'

/**
 * The compact product shape a ProductCard needs. Server components map full
 * catalog products down to this before handing them to client components or
 * returning them from /api/catalog/*, so the browser never receives every
 * variant/price row for every product.
 */
export type ProductCardData = {
  handle:      string
  name:        string
  url:         string
  image:       string | null
  hoverImage:  string | null
  price:       Money
  badges:      string[]
  colours:     { code: string; name: string; hex: string }[]
  gender:      string
  categories:  string[]
  collections: string[]
  sizes:       string[]
  /** Sizes with stock > 0 in any colour — drives the size facet. */
  inStockSizes: string[]
  materials:   string[]
  fit:         string | null
  traits:      string[]
  rating:      number
  reviewCount: number
  sortRank:    number
  launchedAt:  string
  /** First colour's variants, for Quick Add on the card (size → sku/stock/prices). */
  quick:       QuickAdd | null
}

export type QuickAdd = {
  colourName: string
  variants:   { size: string; sku: string; stock: number; prices: Money[] }[]
}

/** Price for `currency`, falling back to the first price present. */
export function priceIn(prices: Money[], currency: CurrencyCode): Money {
  return prices.find((p) => p.currency === currency) ?? prices[0] ?? { currency, amount: 0, compareAt: null }
}

export function toCardData(p: Product, currency: CurrencyCode): ProductCardData {
  const firstImages = p.colours[0]?.images ?? []
  // Hover swap only when there is a genuinely different second image.
  const alt = firstImages[1] ?? p.colours[1]?.images[0] ?? null
  return {
    handle:       p.handle,
    name:         p.name,
    url:          p.url,
    image:        firstImages[0] ?? null,
    hoverImage:   alt && alt !== firstImages[0] ? alt : null,
    price:        priceIn(p.fromPrices, currency),
    badges:       p.badges,
    colours:      p.colours.map(({ code, name, hex }) => ({ code, name, hex })),
    gender:       p.gender,
    categories:   p.categoryHandles,
    collections:  p.collections,
    sizes:        p.sizes,
    inStockSizes: p.sizes.filter((s) => p.variants.some((v) => v.size === s && v.stock > 0)),
    materials:    p.materials,
    fit:          p.fit,
    traits:       p.traits,
    rating:       p.rating,
    reviewCount:  p.reviewCount,
    sortRank:     p.sortRank,
    launchedAt:   p.launchedAt,
    quick:        quickAddFor(p),
  }
}

function quickAddFor(p: Product): QuickAdd | null {
  const colour = p.colours[0]
  if (!colour) return null
  const variants = p.sizes
    .map((size) => p.variants.find((v) => v.colourCode === colour.code && v.size === size))
    .filter((v): v is NonNullable<typeof v> => !!v)
    .map((v) => ({ size: v.size, sku: v.sku, stock: v.stock, prices: v.prices }))
  return variants.length ? { colourName: colour.name, variants } : null
}
