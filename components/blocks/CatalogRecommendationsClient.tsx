'use client'

import { useEffect, useMemo, useState } from 'react'
import ProductCard from '@/components/commerce/ProductCard'
import { useCommerce } from '@/components/commerce/CommerceProvider'
import { trackRecsClick } from '@/lib/commerce/track'
import type { ProductCardData } from '@/lib/commerce/card'

type Props = {
  /** Server-resolved products (trending / category / manual / complete the look). */
  initial?:  ProductCardData[]
  /** Session-driven strategy resolved in the browser from the shopper's own state. */
  dynamic?:  'recentlyViewed' | 'nextBest'
  /** Handle to leave out (the product on a PDP). */
  exclude?:  string
  strategy?: string
  count:     number
  /** Rendered only when there are products — lets the section hide entirely. */
  header?:   React.ReactNode
  onBrand?:  boolean
}

/**
 * Catalog recommendation row. Server strategies arrive as `initial`; the two
 * session strategies read bag / recently-viewed handles from the commerce store
 * and fetch /api/catalog/recommend. When a session strategy has nothing to show
 * (a first-time visitor, an empty bag) the whole section stays hidden rather
 * than rendering an empty shelf.
 */
export default function CatalogRecommendationsClient({ initial, dynamic, exclude, strategy = 'manual', count, header }: Props) {
  const { enabled, state, currency, locale } = useCommerce()
  const [fetched, setFetched] = useState<{ key: string; products: ProductCardData[] } | null>(null)

  const seeds = useMemo(() => {
    if (dynamic === 'nextBest') return state.bag.map((l) => l.handle)
    if (dynamic === 'recentlyViewed') return state.viewed.filter((h) => h !== exclude)
    return []
  }, [dynamic, state.bag, state.viewed, exclude])
  const requestKey = `${dynamic}:${seeds.join(',')}`

  useEffect(() => {
    if (!dynamic || !enabled || !state.hydrated || seeds.length === 0) return
    const controller = new AbortController()
    const q = new URLSearchParams({ strategy: dynamic, seeds: seeds.join(','), limit: String(count), currency, locale })
    if (exclude) q.set('exclude', exclude)
    fetch(`/api/catalog/recommend?${q}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d: { products?: ProductCardData[] }) => setFetched({ key: requestKey, products: d.products ?? [] }))
      .catch(() => { /* aborted or offline — keep the section hidden */ })
    return () => controller.abort()
  }, [dynamic, enabled, state.hydrated, seeds, requestKey, count, exclude, currency, locale])

  const products = dynamic
    ? (seeds.length && fetched?.key === requestKey ? fetched.products : [])
    : (initial ?? [])
  if (products.length === 0) return null

  return (
    <>
      {header}
      <ul className="-mx-md flex snap-x snap-mandatory gap-sm overflow-x-auto px-md pb-sm md:mx-0 md:grid md:grid-cols-3 md:gap-md md:overflow-visible md:px-0 lg:grid-cols-4 [scrollbar-width:thin]">
        {products.slice(0, count).map((p) => (
          <li
            key={p.handle}
            className="flex w-[70%] flex-none snap-start sm:w-[42%] md:w-auto"
            onClickCapture={(e) => { if ((e.target as HTMLElement).closest('a')) trackRecsClick(p.handle, strategy) }}
          >
            <ProductCard product={p} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 70vw" />
          </li>
        ))}
      </ul>
    </>
  )
}
