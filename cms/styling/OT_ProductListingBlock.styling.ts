export type ProductListingColor   = 'canvas' | 'surface'
export type ProductListingColumns = 3 | 4
export type ProductListingAspect  = 'portrait' | 'square'

export type ProductListingStyleOptions = {
  color:        ProductListingColor
  columns:      ProductListingColumns
  cardAspect:   ProductListingAspect
  showFacets:   boolean
  /** Grid index the editorial tile is inserted after. */
  tilePosition: number
}

// Display-template selects return strings: booleans arrive as 'true' / 'false',
// numbers as prefixed keys (col3/col4, pos3/pos5/pos7 — CMS keys must be ≥2 chars).
export function getProductListingStyles(s: Record<string, string | boolean>): ProductListingStyleOptions {
  const bool = (v: string | boolean | undefined, fallback: boolean) =>
    v === undefined ? fallback : v === true || v === 'true'
  return {
    color:        s.color === 'surface' ? 'surface' : 'canvas',
    columns:      s.columns === 'col3' ? 3 : 4,
    cardAspect:   s.cardAspect === 'square' ? 'square' : 'portrait',
    showFacets:   bool(s.showFacets, true),
    tilePosition: ({ pos3: 3, pos5: 5, pos7: 7 } as Record<string, number>)[String(s.tilePosition)] ?? 3,
  }
}
