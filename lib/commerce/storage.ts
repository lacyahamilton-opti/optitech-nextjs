/**
 * Browser persistence for the mock storefront. Everything is namespaced per
 * catalog (`ot-commerce:<catalogId>:<key>`) so two demo sites on the same origin
 * (e.g. localhost during development) never share a bag. All access is wrapped:
 * private mode / blocked storage degrades to in-memory state, never an error.
 *
 * Privacy: nothing here is ever sent to a server. The placed order (the only
 * thing that holds checkout name/address) lives in sessionStorage, so it ends
 * with the tab; everything else is bag/wishlist/persona state for the demo.
 */
export const STORAGE_KEYS = ['bag', 'wishlist', 'viewed', 'order', 'persona', 'shopper'] as const
export type StorageKey = (typeof STORAGE_KEYS)[number]

/** Keys kept in sessionStorage instead of localStorage. */
const SESSION_KEYS: ReadonlySet<StorageKey> = new Set(['order'])

/** Cookie mirror of the bag count so the header can render it server-side. */
export const BAG_COUNT_COOKIE = 'ot_bag_count'
/** Signed-in demo persona's segment (never the identity) for personalisation. */
export const PERSONA_SEGMENT_COOKIE = 'ot_persona'

const nsKey = (catalogId: string, key: StorageKey) => `ot-commerce:${catalogId}:${key}`
const area = (key: StorageKey): Storage => (SESSION_KEYS.has(key) ? window.sessionStorage : window.localStorage)

export function readStored<T>(catalogId: string, key: StorageKey, fallback: T): T {
  try {
    const raw = area(key).getItem(nsKey(catalogId, key))
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeStored(catalogId: string, key: StorageKey, value: unknown): void {
  try {
    if (value === null) area(key).removeItem(nsKey(catalogId, key))
    else area(key).setItem(nsKey(catalogId, key), JSON.stringify(value))
  } catch {
    /* storage full or blocked — state stays in memory for this session */
  }
}

/**
 * Drop data earlier builds kept in localStorage that now belongs in
 * sessionStorage (orders used to persist across sessions).
 */
export function purgeLegacyStorage(catalogId: string): void {
  try {
    for (const key of SESSION_KEYS) window.localStorage.removeItem(nsKey(catalogId, key))
  } catch {
    /* ignore */
  }
}

function writeCookie(name: string, value: string | null): void {
  try {
    document.cookie = value === null
      ? `${name}=; path=/; max-age=0; SameSite=Lax`
      : `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
  } catch {
    /* ignore */
  }
}

export function writeBagCountCookie(count: number): void {
  writeCookie(BAG_COUNT_COOKIE, String(Math.max(0, Math.min(count, 999))))
}

export function writePersonaSegmentCookie(segment: string | null): void {
  writeCookie(PERSONA_SEGMENT_COOKIE, segment)
}

/** True when `key` (a raw localStorage key from a StorageEvent) belongs to this catalog. */
export function isCatalogStorageKey(catalogId: string, rawKey: string | null): boolean {
  return !!rawKey && rawKey.startsWith(`ot-commerce:${catalogId}:`)
}
