/**
 * GET /api/catalog/recommend?strategy=nextBest&seeds=a,b&exclude=c&category=x&limit=4[&currency=USD]
 *
 * Catalog-backed recommendations for strategies whose inputs only exist in the
 * browser (bag contents, recently viewed). Server-renderable strategies
 * (trending, category, manual, completeTheLook on a PDP) are resolved directly
 * in the block adapter instead. Host-gated: 404 on sites without commerce.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { isValidHandle, withCatalogLocale } from '@/lib/catalog'
import { getCommerceSettings } from '@/lib/commerce/settings'
import { isRecStrategy, recommend } from '@/lib/commerce/recommend'
import { toCardData } from '@/lib/commerce/card'
import { withPricing } from '@/lib/commerce/pricing'
import { parseCurrency } from '@/lib/commerce/params'

const list = (v: string | null, max: number) =>
  (v ?? '').split(',').map((s) => s.trim()).filter(isValidHandle).slice(0, max)

export async function GET(request: NextRequest) {
  const settings = await getCommerceSettings(request.headers.get('host') ?? '')
  if (!settings) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const q = request.nextUrl.searchParams
  const strategy = q.get('strategy')
  if (!isRecStrategy(strategy)) return NextResponse.json({ error: 'Unknown strategy' }, { status: 400 })

  const category = q.get('category')
  const limit = Number.parseInt(q.get('limit') ?? '4', 10)
  const currency = parseCurrency(q.get('currency'), settings.currencyCode)

  const products = await withCatalogLocale(q.get('locale'), () => recommend({
    catalogId: settings.catalogId,
    strategy,
    seeds:     list(q.get('seeds'), 24),
    exclude:   list(q.get('exclude'), 48),
    category:  category && isValidHandle(category) ? category : undefined,
    limit:     Number.isFinite(limit) ? limit : 4,
  }).then(withPricing))
  return NextResponse.json(
    { products: products.map((p) => toCardData(p, currency)) },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  )
}
