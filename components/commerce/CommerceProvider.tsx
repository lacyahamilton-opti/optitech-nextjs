'use client'

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createCommerceStore, type CommerceState, type CommerceStore } from '@/lib/commerce/store'
import { priceIn } from '@/lib/commerce/card'
import type { CartLine, CurrencyCode } from '@/lib/commerce/types'
import type { Market } from '@/lib/commerce/market'

/**
 * Mock-storefront context: bag, wishlist, recently viewed, the demo persona and
 * the last order, persisted in browser storage per catalog (see
 * lib/commerce/storage.ts). Mounted by app/(site)/layout.tsx ONLY on sites
 * with ThemeManager `enableCommerce` — every other site never ships it.
 *
 * `useCommerce()` outside a provider returns an inert value (enabled: false,
 * empty state, no-op actions) so shared components (ProductCard in the
 * showcase, the header) can call it unconditionally without crashing.
 */
type CommerceContextValue = {
  enabled:     boolean
  catalogId:   string
  currency:    CurrencyCode
  locale:      string
  /** Shopping market (currency + size labels), see lib/commerce/market.ts. */
  market:      Market
  state:       CommerceState
  bagCount:    number
  subtotal:    number
  bagOpen:     boolean
  lastAdded:   CartLine | null
  openBag:     () => void
  closeBag:    () => void
  addLine:     (line: Omit<CartLine, 'quantity'>, quantity?: number) => CartLine | null
  setQuantity: CommerceStore['setQuantity']
  removeLine:  CommerceStore['removeLine']
  toggleWishlist: (handle: string) => boolean
  recordView:  CommerceStore['recordView']
  completeOrder: CommerceStore['completeOrder']
  signIn:      CommerceStore['signIn']
  signInAsNewShopper: CommerceStore['signInAsNewShopper']
  signOut:     CommerceStore['signOut']
}

const noop = () => {}
const INERT_STATE: CommerceState = { bag: [], wishlist: [], viewed: [], lastOrder: null, persona: null, shopper: null, hydrated: false }

const CommerceContext = createContext<CommerceContextValue>({
  enabled: false, catalogId: '', currency: 'USD', locale: 'en', market: 'default', state: INERT_STATE,
  bagCount: 0, subtotal: 0, bagOpen: false, lastAdded: null,
  openBag: noop, closeBag: noop, addLine: () => null, setQuantity: noop, removeLine: noop,
  toggleWishlist: () => false, recordView: noop, completeOrder: noop, signIn: noop, signInAsNewShopper: noop, signOut: noop,
})

export function useCommerce(): CommerceContextValue {
  return useContext(CommerceContext)
}

/** Subtotal of `lines` in `currency`, in minor units. */
export function bagSubtotal(lines: CartLine[], currency: CurrencyCode): number {
  return lines.reduce((sum, l) => sum + priceIn(l.prices, currency).amount * l.quantity, 0)
}

type Props = {
  catalogId: string
  currency:  CurrencyCode
  locale:    string
  market?:   Market
  /** Showcase only: pre-fill an empty store (in memory until changed). */
  seed?:     { bag?: CartLine[]; wishlist?: string[] }
  children:  ReactNode
}

export default function CommerceProvider({ catalogId, currency, locale, market = 'default', seed, children }: Props) {
  const [store] = useState(() => createCommerceStore(catalogId, seed))
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  const [bagOpen, setBagOpen] = useState(false)
  const [lastAdded, setLastAdded] = useState<CartLine | null>(null)

  const addLine = useCallback((line: Omit<CartLine, 'quantity'>, quantity = 1) => {
    const updated = store.addLine(line, quantity)
    setLastAdded(updated)
    setBagOpen(true)
    return updated
  }, [store])

  const value = useMemo<CommerceContextValue>(() => ({
    enabled: true,
    catalogId,
    currency,
    locale,
    market,
    state,
    bagCount: state.bag.reduce((n, l) => n + l.quantity, 0),
    subtotal: bagSubtotal(state.bag, currency),
    bagOpen,
    lastAdded,
    openBag:  () => { setLastAdded(null); setBagOpen(true) },
    closeBag: () => setBagOpen(false),
    addLine,
    setQuantity:    store.setQuantity,
    removeLine:     store.removeLine,
    toggleWishlist: store.toggleWishlist,
    recordView:     store.recordView,
    completeOrder:  store.completeOrder,
    signIn:         store.signIn,
    signInAsNewShopper: store.signInAsNewShopper,
    signOut:        store.signOut,
  }), [catalogId, currency, locale, market, state, bagOpen, lastAdded, addLine, store])

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>
}
