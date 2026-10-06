import { parseFeedRequest } from '@/lib/feeds/request'
import { getFeed } from '@/lib/feeds/service'
import { clientIp, isRateLimited } from '@/lib/feeds/rateLimit'

// Same-origin only: no CORS headers are set. Errors are generic by design.
const json = (body: unknown, status: number, cache: string, extra?: Record<string, string>) =>
  Response.json(body, { status, headers: { 'Cache-Control': cache, ...extra } })

const fail = (status: number, extra?: Record<string, string>) =>
  json({ error: 'unavailable' }, status, 'no-store', extra)

export async function GET(request: Request, ctx: { params: Promise<{ feedId: string }> }) {
  if (isRateLimited(clientIp(request.headers))) return fail(429, { 'Retry-After': '60' })

  const { feedId } = await ctx.params
  const parsed = parseFeedRequest(feedId, new URL(request.url).searchParams)
  if (!parsed.ok) return fail(parsed.status)

  const result = await getFeed(parsed.entry, parsed.limit)
  if (result.status !== 'ok') return fail(503)

  return json(result.payload, 200, 'public, s-maxage=900, stale-while-revalidate=3600')
}
