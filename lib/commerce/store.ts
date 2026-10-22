import type { CartLine, Order } from '@/lib/commerce/types'
import { isCatalogStorageKey, purgeLegacyStorage, readStored, writeBagCountCookie, writePersonaSegmentCookie, writeStored } from '@/lib/commerce/storage'
import { currentPersona, getPersona, isShopper, makeRandomShopper, SHOPPER_ID, type DemoPersona, type PersonaSegment } from '@/lib/commerce/personas'
import { forgetPersona, identifyPersona } from '@/lib/commerce/identify'

/**
 * External store for the mock storefront, consumed with useSyncExternalStore.
 * State lives in browser storage (per catalog; see storage.ts); the store keeps an in-memory copy
 * so snapshots are referentially stable between changes.
 */
export type CommerceState = {
  bag:       CartLine[]
  wishlist:  string[]
  viewed:    string[]
  lastOrder: Order | null
  /** Signed-in demo persona id (lib/commerce/personas.ts), SHOPPER_ID, or null for a guest. */
  persona:   string | null
  /** The generated "New shopper" profile, when persona === SHOPPER_ID. */
  shopper:   DemoPersona | null
  /** False on the server snapshot and the first hydration pass. */
  hydrated:  boolean
}

const EMPTY: CommerceState = { bag: [], wishlist: [], viewed: [], lastOrder: null, persona: null, shopper: null, hydrated: false }
const MAX_VIEWED = 12
const MAX_QTY = 10

export type CommerceStore = ReturnType<typeof createCommerceStore>

/**
 * `seed` pre-fills an EMPTY store (showcase demos only). Seeded values stay in
 * memory until the shopper changes something, so a demo never overwrites a
 * real bag.
 */
export function createCommerceStore(catalogId: string, seed?: Partial<Pick<CommerceState, 'bag' | 'wishlist'>>) {
  let state: CommerceState = EMPTY
  const listeners = new Set<() => void>()

  const load = (): CommerceState => {
    const stored = readStored<unknown>(catalogId, 'shopper', null)
    const shopper = isShopper(stored) ? stored : null
    const id = readStored<string | null>(catalogId, 'persona', null)
    return {
      bag:       readStored<CartLine[]>(catalogId, 'bag', seed?.bag ?? []),
      wishlist:  readStored<string[]>(catalogId, 'wishlist', seed?.wishlist ?? []),
      viewed:    readStored<string[]>(catalogId, 'viewed', []),
      lastOrder: readStored<Order | null>(catalogId, 'order', null),
      persona:   id === SHOPPER_ID ? (shopper ? id : null) : getPersona(id)?.id ?? null,
      shopper,
      hydrated:  true,
    }
  }

  if (typeof window !== 'undefined') {
    purgeLegacyStorage(catalogId)
    state = load()
  }

  const emit = () => listeners.forEach((l) => l())

  function set(next: Partial<CommerceState>) {
    state = { ...state, ...next, hydrated: true }
    if (next.bag) {
      writeStored(catalogId, 'bag', next.bag)
      writeBagCountCookie(next.bag.reduce((n, l) => n + l.quantity, 0))
    }
    if (next.wishlist) writeStored(catalogId, 'wishlist', next.wishlist)
    if (next.viewed) writeStored(catalogId, 'viewed', next.viewed)
    if (next.lastOrder !== undefined) writeStored(catalogId, 'order', next.lastOrder)
    if (next.shopper !== undefined) writeStored(catalogId, 'shopper', next.shopper)
    if (next.persona !== undefined) {
      writeStored(catalogId, 'persona', next.persona)
      writePersonaSegmentCookie(currentPersona(state)?.segment ?? null)
    }
    emit()
  }

  const reload = () => { state = load(); emit() }

  return {
    getSnapshot:       () => state,
    getServerSnapshot: () => EMPTY,
    subscribe(listener: () => void) {
      listeners.add(listener)
      // Keep tabs in sync, and clear with the global demo reset (lib/demo/state.ts).
      const onStorage = (e: StorageEvent) => { if (e.key === null || isCatalogStorageKey(catalogId, e.key)) reload() }
      // localStorage.clear() in the reset doesn't reach sessionStorage or cookies.
      const onReset = () => { writeStored(catalogId, 'order', null); writeBagCountCookie(0); writePersonaSegmentCookie(null); forgetPersona(); reload() }
      window.addEventListener('storage', onStorage)
      window.addEventListener('demo:reset', onReset)
      return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('demo:reset', onReset)
      }
    },

    addLine(line: Omit<CartLine, 'quantity'>, quantity = 1): CartLine {
      const existing = state.bag.find((l) => l.sku === line.sku)
      const qty = Math.min(MAX_QTY, (existing?.quantity ?? 0) + quantity)
      const updated: CartLine = { ...line, quantity: qty }
      set({ bag: existing ? state.bag.map((l) => (l.sku === line.sku ? updated : l)) : [...state.bag, updated] })
      return updated
    },
    setQuantity(sku: string, quantity: number) {
      const q = Math.max(0, Math.min(MAX_QTY, Math.round(quantity)))
      set({ bag: q === 0 ? state.bag.filter((l) => l.sku !== sku) : state.bag.map((l) => (l.sku === sku ? { ...l, quantity: q } : l)) })
    },
    removeLine(sku: string) {
      set({ bag: state.bag.filter((l) => l.sku !== sku) })
    },
    toggleWishlist(handle: string): boolean {
      const has = state.wishlist.includes(handle)
      set({ wishlist: has ? state.wishlist.filter((h) => h !== handle) : [handle, ...state.wishlist] })
      return !has
    },
    recordView(handle: string) {
      if (state.viewed[0] === handle) return
      set({ viewed: [handle, ...state.viewed.filter((h) => h !== handle)].slice(0, MAX_VIEWED) })
    },
    completeOrder(order: Order) {
      set({ lastOrder: order, bag: [] })
    },
    /** Sign in as a fixed demo persona. Switching from another shopper starts a fresh identity first. */
    signIn(personaId: string) {
      const persona = getPersona(personaId)
      if (!persona || state.persona === personaId) return
      if (state.persona) forgetPersona()
      set({ persona: personaId, shopper: null })
      identifyPersona(persona)
    },
    /** Sign in as a newly generated fictitious shopper (random tier unless given). */
    signInAsNewShopper(segment?: PersonaSegment) {
      const shopper = makeRandomShopper(segment)
      if (state.persona) forgetPersona()
      set({ persona: SHOPPER_ID, shopper })
      identifyPersona(shopper)
    },
    signOut() {
      if (!state.persona) return
      set({ persona: null, shopper: null })
      forgetPersona()
    },
  }
}
