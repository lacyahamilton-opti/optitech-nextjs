import 'server-only'
import { getProducts, getProductsByHandles, getRelated, getProductByHandle } from '@/lib/catalog'
import type { Product } from '@/lib/commerce/types'

/**
 * Catalog-backed recommendation strategies for the Product Recommendations
 * block (source = catalog) and /api/catalog/recommend.
 *
 * These are deterministic merchandising rules over the catalog — the seam where
 * real 1:1 signals plug in later (ODP segments / next-best-product, backlog
 * APP-023). Peerius-sourced recs are untouched and live in
 * components/blocks/ProductRecommendationsClient.tsx.
 */
export const REC_STRATEGIES = ['manual', 'trending', 'category', 'completeTheLook', 'recentlyViewed', 'nextBest'] as const
export type RecStrategy = (typeof REC_STRATEGIES)[number]

export function isRecStrategy(s: string | null | undefined): s is RecStrategy {
  return !!s && (REC_STRATEGIES as readonly string[]).includes(s)
}

export type RecRequest = {
  catalogId:  string
  strategy:   RecStrategy
  /** Handles the strategy works from: manual picks, the PDP product, bag lines, recently viewed. */
  seeds?:     string[]
  category?:  string
  exclude?:   string[]
  limit?:     number
}

/** Popularity score: rating weighted by review volume, nudged by merchandising badges. */
function trendScore(p: Product): number {
  const boost = (p.badges.includes('bestseller') ? 1.3 : 1) * (p.badges.includes('new') ? 1.15 : 1)
  return p.rating * Math.log10(10 + p.reviewCount) * boost
}

export async function recommend(req: RecRequest): Promise<Product[]> {
  const limit = Math.min(Math.max(req.limit ?? 4, 1), 12)
  const seeds = req.seeds ?? []
  const skip = new Set(req.exclude ?? [])
  const keep = (list: Product[]) => list.filter((p) => !skip.has(p.handle)).slice(0, limit)

  switch (req.strategy) {
    case 'manual':
      return keep(await getProductsByHandles(req.catalogId, seeds))

    case 'recentlyViewed':
      return keep(await getProductsByHandles(req.catalogId, seeds))

    case 'category':
      return keep(await getProducts(req.catalogId, { category: req.category }))

    case 'trending': {
      const pool = (await getProducts(req.catalogId, req.category ? { category: req.category } : {}))
        .filter((p) => !p.badges.includes('archive'))
      return keep([...pool].sort((a, b) => trendScore(b) - trendScore(a)))
    }

    case 'completeTheLook': {
      const seed = seeds[0] ? await getProductByHandle(req.catalogId, seeds[0]) : null
      if (!seed) return []
      return keep(await getRelated(req.catalogId, seed, limit + skip.size))
    }

    case 'nextBest': {
      // Pairings of what's already in the bag first (curated "wears with"),
      // then trending items from categories the shopper hasn't touched yet.
      const owned = await getProductsByHandles(req.catalogId, seeds)
      const ownedSet = new Set(seeds)
      const pairedHandles = [...new Set(owned.flatMap((p) => p.pairsWith))].filter((h) => !ownedSet.has(h))
      const paired = await getProductsByHandles(req.catalogId, pairedHandles)
      const touched = new Set(owned.map((p) => p.primaryCategory))
      const fresh = (await getProducts(req.catalogId))
        .filter((p) => !ownedSet.has(p.handle) && !touched.has(p.primaryCategory) && !p.badges.includes('archive'))
        .sort((a, b) => trendScore(b) - trendScore(a))
      const seen = new Set<string>()
      return keep([...paired, ...fresh].filter((p) => (seen.has(p.handle) ? false : (seen.add(p.handle), true))))
    }
  }
}
