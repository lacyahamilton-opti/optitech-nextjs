import { getEnabledFeed, type FeedEntry } from './registry'

export const DEFAULT_LIMIT = 6
export const MIN_LIMIT = 1
export const MAX_LIMIT = 12

export type FeedRequest =
  | { ok: true; entry: FeedEntry; limit: number }
  | { ok: false; status: 400 | 404 }

/**
 * Strict validation for GET /api/feeds/[feedId]?limit=N.
 * feedId → registry allowlist (404 if unknown or disabled).
 * limit  → integer (clamped 1–12, default 6); anything else 400.
 * Other query parameters are ignored.
 */
export function parseFeedRequest(feedId: unknown, searchParams: URLSearchParams): FeedRequest {
  const entry = typeof feedId === 'string' && /^[a-z0-9-]{1,40}$/.test(feedId) ? getEnabledFeed(feedId) : undefined
  if (!entry) return { ok: false, status: 404 }

  const values = searchParams.getAll('limit')
  if (values.length > 1) return { ok: false, status: 400 }
  let limit = DEFAULT_LIMIT
  if (values.length === 1) {
    if (!/^-?\d{1,6}$/.test(values[0])) return { ok: false, status: 400 }
    limit = Math.min(Math.max(parseInt(values[0], 10), MIN_LIMIT), MAX_LIMIT)
  }
  return { ok: true, entry, limit }
}
