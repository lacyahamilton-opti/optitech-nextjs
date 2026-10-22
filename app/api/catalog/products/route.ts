/**
 * GET /api/catalog/products?handles=a,b,c[&currency=USD]
 *
 * Card data for specific products, in the order given. Used by client-side
 * commerce views whose product list only exists in the browser (wishlist,
 * recently viewed). Host-gated: 404 on sites without mock commerce enabled.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { getProductsByHandles, isValidHandle, withCatalogLocale } from '@/lib/catalog'
import { getCommerceSettings } from '@/lib/commerce/settings'
import { toCardData } from '@/lib/commerce/card'
import { withPricing } from '@/lib/commerce/pricing'
import { parseCurrency } from '@/lib/commerce/params'

const MAX_HANDLES = 24

export async function GET(request: NextRequest) {
  const settings = await getCommerceSettings(request.headers.get('host') ?? '')
  if (!settings) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const handles = (request.nextUrl.searchParams.get('handles') ?? '')
    .split(',').map((h) => h.trim()).filter(isValidHandle).slice(0, MAX_HANDLES)
  const currency = parseCurrency(request.nextUrl.searchParams.get('currency'), settings.currencyCode)

  const products = await withCatalogLocale(request.nextUrl.searchParams.get('locale'), () => getProductsByHandles(settings.catalogId, handles).then(withPricing))
  return NextResponse.json(
    { products: products.map((p) => toCardData(p, currency)) },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  )
}
