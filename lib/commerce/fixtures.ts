import catalog from '@/data/catalog/apparel.json'
import { toCardData, type ProductCardData } from '@/lib/commerce/card'
import type { CartLine, Category, Product } from '@/lib/commerce/types'

/**
 * Static fixtures for the block showcase (/showcase/blocks/*). Read straight
 * from the canonical catalog JSON so the showcase always matches real data
 * without a Graph round trip or a commerce-enabled host.
 */
const PRODUCTS = (catalog as unknown as { products: Product[] }).products
const CATEGORIES = (catalog as unknown as { categories: Category[] }).categories

export function fixtureCards(filter: (p: Product) => boolean = () => true, limit = 48): ProductCardData[] {
  return PRODUCTS.filter(filter).slice(0, limit).map((p) => toCardData(p, 'USD'))
}

export function fixtureSubCategories(parent: string): { handle: string; name: string }[] {
  return CATEGORIES.filter((c) => c.parentHandle === parent).map((c) => ({ handle: c.handle, name: c.name }))
}

/** A two-line bag for the Commerce Flow showcase. */
export function fixtureBag(): CartLine[] {
  const pick = (handle: string, sizeIndex: number, quantity: number): CartLine | null => {
    const p = PRODUCTS.find((x) => x.handle === handle)
    const colour = p?.colours[0]
    const v = p?.variants.find((x) => x.colourCode === colour?.code && x.size === p.sizes[sizeIndex] && x.stock > 0)
      ?? p?.variants.find((x) => x.stock > 0)
    if (!p || !v) return null
    return {
      sku: v.sku, handle: p.handle, name: p.name, colourName: p.colours.find((c) => c.code === v.colourCode)?.name ?? '',
      size: v.size, image: p.colours.find((c) => c.code === v.colourCode)?.images[0] ?? null, prices: v.prices, quantity,
    }
  }
  return [pick('loden-wool-car-coat', 2, 1), pick('oversized-lambswool-scarf', 0, 1)].filter((l): l is CartLine => !!l)
}
