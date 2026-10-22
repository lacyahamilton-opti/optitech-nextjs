/**
 * POST /api/bq/retail-order
 *
 * Records a placed mock-checkout order in the retail analytics tables
 * (lib/bq/retail-schema.ts), so the connected-analytics demo (dashboards, the
 * natural-language analytics agent) sees live orders next to the generated
 * history. Fire-and-forget from CheckoutView.
 *
 * Trust nothing from the browser except WHAT was bought: SKUs and quantities
 * are re-priced here from the catalog (with the request's FX price treatment),
 * so totals can't be forged. No name, email or address is accepted or stored:
 * the customer is the fictitious demo persona's id (or a generated shopper's
 * tier and boutique city) suffixed with the browser's demo id — matching the
 * per-demo ODP profile (lib/commerce/identify.ts) — or an anonymous visitor id.
 * Host-gated (commerce sites only); a no-op when BigQuery isn't configured.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getBigQuery } from '@/lib/bq/client'
import { insertRetailOrder } from '@/lib/bq/retail'
import { COST_RATIO } from '@/lib/bq/retail-schema'
import { getProductsByHandles, isValidHandle } from '@/lib/catalog'
import { getCommerceSettings } from '@/lib/commerce/settings'
import { withPricing } from '@/lib/commerce/pricing'
import { parseCurrency } from '@/lib/commerce/params'
import { FREE_SHIPPING_THRESHOLD, SHIPPING } from '@/lib/commerce/money'
import { getPersona, PERSONA_SEGMENTS, SHOPPER_HOMES, SHOPPER_ID, type PersonaSegment } from '@/lib/commerce/personas'
import { ACQ_COOKIE, parseAcquisition } from '@/lib/acquisition'

export const dynamic = 'force-dynamic'

const ORDER_ID = /^[A-Z]{2}-[A-Z0-9]{4,12}$/
const SKU = /^[A-Z0-9-]{3,40}$/
const DEMO_ID = /^[a-z0-9]{6}$/

function channelFor(source: string, medium: string): string {
  const m = medium.toLowerCase(), s = source.toLowerCase()
  if (/cpc|paid_search|ppc/.test(m)) return 'paid_search'
  if (/paid_social|social_paid|paidsocial/.test(m)) return 'paid_social'
  if (m === 'email' || s === 'newsletter') return 'email'
  if (/chatgpt|perplexity|gemini|copilot|claude/.test(s)) return 'ai_referral'
  if (/google|bing|duckduckgo|ecosia/.test(s)) return 'organic'
  if (m === 'referral') return 'referral'
  return s ? 'referral' : 'direct'
}

export async function POST(request: NextRequest) {
  const commerce = await getCommerceSettings(request.headers.get('host') ?? '')
  if (!commerce) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!getBigQuery()) return NextResponse.json({ ok: false, reason: 'BigQuery not configured' }, { status: 202 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }

  const orderId = typeof body.orderId === 'string' && ORDER_ID.test(body.orderId) ? body.orderId : null
  const rawLines = Array.isArray(body.lines) ? body.lines.slice(0, 30) : []
  if (!orderId || rawLines.length === 0) return NextResponse.json({ error: 'Invalid order' }, { status: 400 })

  const currency = parseCurrency(typeof body.currency === 'string' ? body.currency : null, commerce.currencyCode)
  const delivery = body.delivery === 'express' || body.delivery === 'collect' ? body.delivery : 'standard'
  const device = body.device === 'mobile' || body.device === 'tablet' ? body.device : 'desktop'
  const demoId = typeof body.demoId === 'string' && DEMO_ID.test(body.demoId) ? body.demoId : 'nodemo'
  const personaId = typeof body.personaId === 'string' ? body.personaId : null
  // A generated shopper: only its tier and (known) boutique city are accepted.
  const shopperHome = SHOPPER_HOMES.find((h) => h.city === body.city)
  const persona = personaId === SHOPPER_ID
    ? { segment: PERSONA_SEGMENTS.includes(body.segment as PersonaSegment) ? body.segment as PersonaSegment : 'new', address: { city: shopperHome?.city ?? 'New York, NY', country: shopperHome?.country ?? 'United States' } }
    : getPersona(personaId)
  const visitor = request.cookies.get('optimizely_user_id')?.value?.replace(/[^\w-]/g, '').slice(0, 12)
  const customerId = personaId === SHOPPER_ID ? `shopper-${demoId}`
    : persona ? `persona-${personaId}-${demoId}`
    : `visitor-${visitor || 'anonymous'}`
  const acq = parseAcquisition(request.cookies.get(ACQ_COOKIE)?.value)

  // Re-price from the catalog (same FX treatment the shopper saw).
  const wanted = rawLines
    .map((l) => (l && typeof l === 'object' ? l as Record<string, unknown> : {}))
    .filter((l) => typeof l.handle === 'string' && isValidHandle(l.handle) && typeof l.sku === 'string' && SKU.test(l.sku))
    .map((l) => ({ handle: l.handle as string, sku: l.sku as string, quantity: Math.min(10, Math.max(1, Number(l.quantity) || 1)) }))
  const products = await getProductsByHandles(commerce.catalogId, [...new Set(wanted.map((l) => l.handle))]).then(withPricing)
  const byHandle = new Map(products.map((p) => [p.handle, p]))

  const now = new Date().toISOString()
  let subtotal = 0, discount = 0, label: string | null = null
  const lines: Record<string, unknown>[] = []
  for (const l of wanted) {
    const p = byHandle.get(l.handle)
    const v = p?.variants.find((x) => x.sku === l.sku)
    const price = v?.prices.find((x) => x.currency === currency)
    if (!p || !v || !price) continue
    const unit = price.amount / 100
    const lineTotal = unit * l.quantity
    const cost = Math.round((price.compareAt ?? price.amount) * (COST_RATIO[p.categoryHandles[0]] ?? 0.4)) / 100
    subtotal += lineTotal
    if (price.label) { label = price.label; discount += ((price.compareAt ?? price.amount) - price.amount) / 100 * l.quantity }
    lines.push({
      order_id: orderId, customer_id: customerId, placed_at: now, sku: v.sku, product_id: p.handle, product_name: p.name,
      category: p.primaryCategory, gender: p.gender, collection: p.collections[0] ?? null, size: v.size,
      colour: p.colours.find((c) => c.code === v.colourCode)?.name ?? v.colourCode, quantity: l.quantity,
      unit_price: unit, line_total: lineTotal, unit_cost: cost, margin: Math.round((lineTotal - cost * l.quantity) * 100) / 100,
      currency, source: 'live',
    })
  }
  if (!lines.length) return NextResponse.json({ error: 'No known items' }, { status: 400 })

  // Same rule as CheckoutView (minor units there, major here).
  const shipping = delivery === 'standard' && subtotal * 100 >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING[delivery].amount / 100
  const rows = {
    customer: {
      customer_id: customerId, loyalty_tier: persona?.segment ?? 'new',
      home_city: persona?.address.city ?? null, home_country: persona?.address.country ?? null,
      acquisition_channel: acq ? channelFor(acq.source, acq.medium) : 'direct',
      acquisition_source: acq?.source ?? null, acquisition_campaign: acq?.campaign || null,
      first_seen_at: now, created_at: now, source: 'live',
    },
    order: {
      order_id: orderId, customer_id: customerId, placed_at: now, currency,
      subtotal, discount: Math.round(discount * 100) / 100, shipping, total: subtotal + shipping,
      item_count: lines.reduce((n, l) => n + (l.quantity as number), 0), delivery,
      store_city: delivery === 'collect' ? (persona?.address.city.split(',')[0] ?? null) : null,
      channel: acq ? channelFor(acq.source, acq.medium) : 'direct',
      utm_source: acq?.source ?? null, utm_medium: acq?.medium || null, utm_campaign: acq?.campaign || null,
      device, loyalty_tier: persona?.segment ?? 'new', price_treatment: label, source: 'live',
    },
    lines,
  }

  try {
    await insertRetailOrder(rows)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[BQ:retail-order] insert failed:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
