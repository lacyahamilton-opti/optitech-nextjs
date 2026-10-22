import { trackConversion } from '@/lib/fx/track'
import { markOdpDirect } from '@/lib/fx/browser-client'
import { RETAIL_EVENTS, type RetailEventKey } from '@/lib/commerce/events'
import type { CartLine, Order } from '@/lib/commerce/types'

/**
 * Storefront events. Every key is defined in lib/commerce/events.ts (the setup
 * checklist for FX / Web Experimentation comes from there too). Each event is:
 *   - FX trackEvent (via trackConversion) when it is an FX metric,
 *   - pushed to Web Experimentation when its snippet is on the page,
 *   - sent DIRECTLY to ODP as a native event (product / order / navigation …),
 *     so ODP capture never depends on the FX project knowing the event key.
 * The FX→ODP TRACK forward skips these keys, so nothing is counted twice.
 *
 * Privacy: tags carry ids, counts and totals only — never name, email or address.
 */

declare global {
  interface Window {
    /** Web Experimentation command queue (the snippet replays it on load). */
    optimizely?: { push: (cmd: Record<string, unknown>) => unknown }
  }
}

type Tags = Record<string, string | number | boolean>

markOdpDirect(Object.keys(RETAIL_EVENTS))

function odp(type: string, data: Record<string, unknown>): void {
  try { window.zaius?.event(type, data) } catch { /* ODP not loaded */ }
}

function emit(key: RetailEventKey, tags: Tags, odpData: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const def = RETAIL_EVENTS[key]
  if (def.fx) trackConversion(key, tags)
  if (def.web) {
    try { window.optimizely?.push({ type: 'event', eventName: key, tags }) } catch { /* snippet absent */ }
  }
  odp(def.odp.type, def.odp.action ? { action: def.odp.action, ...odpData } : odpData)
}

const major = (minor: number) => Math.round(minor) / 100

export function trackProductView(handle: string, name: string, category: string): void {
  emit('product_view', { product_id: handle, product_name: name, category }, { product_id: handle })
}

export function trackAddToCart(line: CartLine, currency: string, amountMinor: number, source: 'pdp' | 'quick_add' = 'pdp'): void {
  emit('add_to_cart',
    { product_id: line.handle, sku: line.sku, quantity: line.quantity, currency, value: major(amountMinor), source },
    { product_id: line.handle })
}

export function trackRemoveFromCart(line: CartLine): void {
  emit('remove_from_cart', { product_id: line.handle, sku: line.sku, quantity: line.quantity }, { product_id: line.handle })
}

export function trackWishlistAdd(handle: string): void {
  emit('wishlist_add', { product_id: handle }, { product_id: handle })
}

export function trackBeginCheckout(itemCount: number, currency: string, subtotalMinor: number): void {
  emit('begin_checkout', { item_count: itemCount, currency, value: major(subtotalMinor) }, { item_count: itemCount, value: major(subtotalMinor) })
}

export function trackShippingInfo(method: string, currency: string, subtotalMinor: number): void {
  emit('add_shipping_info', { shipping_method: method, currency, value: major(subtotalMinor) }, { shipping_method: method })
}

export function trackPaymentInfo(currency: string, totalMinor: number): void {
  emit('add_payment_info', { currency, value: major(totalMinor) }, { value: major(totalMinor) })
}

/** FX's reserved `revenue` tag is an integer in minor units; `value` is in major units. */
export function trackPurchase(order: Order, extra: Tags = {}): void {
  const itemCount = order.lines.reduce((n, l) => n + l.quantity, 0)
  const unit = (l: CartLine) => l.prices.find((p) => p.currency === order.currency)?.amount ?? 0
  emit('purchase',
    { order_id: order.id, revenue: Math.round(order.total), value: major(order.total), currency: order.currency, item_count: itemCount, ...extra },
    {
      order: {
        order_id: order.id,
        total:    major(order.total),
        subtotal: major(order.subtotal),
        shipping: major(order.shipping),
        items:    order.lines.map((l) => ({
          product_id: l.handle,
          price:      major(unit(l)),
          quantity:   l.quantity,
          subtotal:   major(unit(l) * l.quantity),
        })),
      },
    })
}

export function trackSearch(term: string, resultCount: number): void {
  const t = term.trim().slice(0, 100)
  if (!t) return
  emit('search', { search_term: t, result_count: resultCount }, { search_term: t })
  if (resultCount === 0) emit('search_no_results', { search_term: t }, { search_term: t })
}

export function trackFilterApply(facet: string, value: string): void {
  emit('filter_apply', { facet, value }, { facet, value })
}

export function trackRecsClick(handle: string, strategy: string): void {
  emit('recs_click', { product_id: handle, strategy }, { product_id: handle, strategy })
}

export function trackSignIn(loyaltyTier: string): void {
  emit('sign_in', { loyalty_tier: loyaltyTier }, {})
}
