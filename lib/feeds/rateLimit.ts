/**
 * Per-IP fixed-window rate limiter for the feed route.
 *
 * In-memory → per server instance (serverless instances don't share counters),
 * so this is a backstop; the platform/gateway remains the primary control.
 * Config: FEED_RATE_LIMIT (requests/minute/IP, default 120),
 *         FEED_RATE_LIMIT_MODE ('enforce' default | 'log' = count + log only).
 */
const WINDOW_MS = 60_000
const MAX_TRACKED = 10_000
const hits = new Map<string, { count: number; resetAt: number }>()

export function rateLimitConfig() {
  const n = parseInt(process.env.FEED_RATE_LIMIT ?? '', 10)
  return {
    limit:   Number.isFinite(n) && n > 0 ? n : 120,
    enforce: (process.env.FEED_RATE_LIMIT_MODE ?? 'enforce') !== 'log',
  }
}

/** First hop of X-Forwarded-For (set by the platform edge), else a shared bucket. */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (xff && xff.length <= 64 ? xff : headers.get('x-real-ip')?.slice(0, 64)) || 'unknown'
}

/** Returns true when the request should be rejected. */
export function isRateLimited(ip: string, now = Date.now()): boolean {
  const { limit, enforce } = rateLimitConfig()
  if (hits.size > MAX_TRACKED) {
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
    if (hits.size > MAX_TRACKED) hits.clear()
  }
  const cur = hits.get(ip)
  if (!cur || cur.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  cur.count++
  if (cur.count <= limit) return false
  if (cur.count === limit + 1) console.warn(`[feeds] rate limit exceeded (${enforce ? 'enforcing' : 'log-only'})`)
  return enforce
}

export function _resetRateLimit(): void { hits.clear() }
