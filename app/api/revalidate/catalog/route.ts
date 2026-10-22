/**
 * Catalog cache revalidation webhook.
 *
 * lib/catalog.ts caches Graph product reads under the `catalog` tag. After the
 * catalog is re-pushed to Graph (scripts/catalog/push-catalog.mjs, or later the
 * OCP connector), POST here to make the next request read fresh data instead of
 * waiting out the 5-minute revalidate window.
 *
 *   curl -X POST https://<site>/api/revalidate/catalog -H "x-revalidate-secret: $CATALOG_REVALIDATE_SECRET"
 *
 * Disabled (404) unless CATALOG_REVALIDATE_SECRET is set.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { timingSafeEqual } from 'node:crypto'
import { CATALOG_CACHE_TAG } from '@/lib/catalog'

export const runtime = 'nodejs'

function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const secret = process.env.CATALOG_REVALIDATE_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 404 })
  if (!secretMatches(request.headers.get('x-revalidate-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Next 16: the single-argument form is deprecated; 'max' = stale-while-revalidate.
  revalidateTag(CATALOG_CACHE_TAG, 'max')
  return NextResponse.json({ revalidated: true, tag: CATALOG_CACHE_TAG })
}
