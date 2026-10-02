import type { FeedEntry } from './registry'
import { safeFetchFeed, FeedFetchError, REVALIDATE_S, type SafeFetchOptions } from './safeFetch'
import { normalizeFeed, MAX_ITEMS } from './normalize'
import type { FeedItem, FeedResult, FeedSource } from './types'

const FRESH_MS    = REVALIDATE_S * 1000
const NEGATIVE_MS = 60_000 // after a failure, don't re-hit the upstream for a minute

type CacheEntry = { items: FeedItem[]; at: number }
const lastGood = new Map<string, CacheEntry>()
const failedAt = new Map<string, number>()
const inflight = new Map<string, Promise<CacheEntry | null>>()

export function toSource(entry: FeedEntry): FeedSource {
  return { id: entry.id, label: entry.label, name: entry.sourceName, homepage: entry.homepage }
}

async function refresh(entry: FeedEntry, opts: SafeFetchOptions): Promise<CacheEntry | null> {
  try {
    const res = await safeFetchFeed(entry, opts)
    const { items, warnings } = normalizeFeed(res.body, { limit: MAX_ITEMS })
    if (items.length === 0) {
      console.warn(`[feeds] ${entry.id}: no items`, warnings)
      return null
    }
    const fresh = { items, at: Date.now() }
    lastGood.set(entry.id, fresh)
    failedAt.delete(entry.id)
    return fresh
  } catch (err) {
    // Details stay server-side; only the code is logged (no URLs, headers or bodies).
    console.warn(`[feeds] ${entry.id}: fetch failed`, err instanceof FeedFetchError ? err.code : 'unknown')
    failedAt.set(entry.id, Date.now())
    return null
  }
}

/**
 * Registry entry → normalized items. Serves last-good data when the upstream
 * fails; returns `unavailable` only when there is nothing to serve. Never throws.
 */
export async function getFeed(entry: FeedEntry, limit: number, opts: SafeFetchOptions = {}): Promise<FeedResult> {
  const source = toSource(entry)
  const cached = lastGood.get(entry.id)
  const now = Date.now()

  let use: CacheEntry | null | undefined = cached
  const fresh = cached && now - cached.at < FRESH_MS
  const backoff = (failedAt.get(entry.id) ?? 0) + NEGATIVE_MS > now
  if (!fresh && !backoff) {
    let p = inflight.get(entry.id)
    if (!p) {
      p = refresh(entry, opts).finally(() => inflight.delete(entry.id))
      inflight.set(entry.id, p)
    }
    use = (await p) ?? cached
  }

  if (!use) return { status: 'unavailable', source }
  return { status: 'ok', payload: { source, items: use.items.slice(0, limit) } }
}

/** Test hook. */
export function _resetFeedCache(): void {
  lastGood.clear(); failedAt.clear(); inflight.clear()
}
