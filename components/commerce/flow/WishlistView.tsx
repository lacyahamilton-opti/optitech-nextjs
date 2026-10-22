'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import ProductCard from '@/components/commerce/ProductCard'
import { EmptyState, type FlowCopy } from '@/components/commerce/flow/BagView'
import { useCommerce } from '@/components/commerce/CommerceProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { localizedHref } from '@/lib/i18n/config'
import type { ProductCardData } from '@/lib/commerce/card'

/**
 * Saved products. The wishlist only stores handles in the browser, so card
 * data is fetched from /api/catalog/products (current prices and stock, like a
 * real wishlist). Un-hearting a card removes it from the grid immediately.
 */
export default function WishlistView({ heading, emptyMessage, continueLabel, continueUrl }: FlowCopy) {
  const { t, locale } = useTranslation()
  const { state, currency } = useCommerce()
  const [cards, setCards] = useState<{ key: string; products: ProductCardData[] } | null>(null)
  const home = continueUrl || localizedHref('/', locale)
  const key = state.wishlist.join(',')

  useEffect(() => {
    if (!state.hydrated || !key) return
    const controller = new AbortController()
    fetch(`/api/catalog/products?handles=${encodeURIComponent(key)}&currency=${currency}&locale=${locale}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d: { products?: ProductCardData[] }) => setCards({ key, products: d.products ?? [] }))
      .catch(() => {})
    return () => controller.abort()
  }, [state.hydrated, key, currency, locale])

  if (!state.hydrated) return <div className="min-h-[40vh]" aria-busy="true" />

  const saved = new Set(state.wishlist)
  // Keep the last fetched set but drop anything un-hearted since, so removal is instant.
  const products = (cards?.products ?? []).filter((p) => saved.has(p.handle))

  return (
    <div>
      <h1 className="mb-lg text-headline font-semibold leading-headline tracking-headline text-fg">
        {heading || t('commerce.wishlist')} <span className="text-fg-muted">({state.wishlist.length})</span>
      </h1>
      {state.wishlist.length === 0 ? (
        <EmptyState icon={<Heart size={32} strokeWidth={1.25} />} message={emptyMessage || t('commerce.wishlistEmpty')} hint={t('commerce.wishlistEmptyHint')} continueLabel={continueLabel || t('commerce.continueShopping')} continueUrl={home} />
      ) : cards === null ? (
        <div className="min-h-[40vh]" aria-busy="true" />
      ) : (
        <ul className="grid grid-cols-2 gap-x-sm gap-y-lg md:gap-x-md lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <li key={p.handle} className="flex"><ProductCard product={p} /></li>
          ))}
        </ul>
      )}
    </div>
  )
}
