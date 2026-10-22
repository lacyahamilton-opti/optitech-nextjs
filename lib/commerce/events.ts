/**
 * Storefront event catalog — the single source of truth for every event the
 * mock storefront emits. lib/commerce/track.ts only sends keys listed here, and
 * `node scripts/fx/print-events.mjs` prints this table as the setup checklist
 * for the FX and Web Experimentation projects (an FX event key that is not in
 * the datafile is silently dropped by trackEvent, so they must exist there).
 *
 * Each event goes to up to three places:
 *   - fx:  FX trackEvent (experiment metrics). `revenue` is integer minor units.
 *   - web: window.optimizely.push({type:'event'}) for Web Experimentation metrics.
 *   - odp: sent DIRECTLY to ODP (never via FX), as the native event noted, so ODP
 *          capture does not depend on the FX project's event list.
 */
export type RetailEventKey =
  | 'product_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'wishlist_add'
  | 'begin_checkout'
  | 'add_shipping_info'
  | 'add_payment_info'
  | 'purchase'
  | 'search'
  | 'search_no_results'
  | 'filter_apply'
  | 'recs_click'
  | 'sign_in'

export type RetailEventDef = {
  description: string
  /** Tag names sent with the event (FX event tags / ODP fields). */
  tags:        string[]
  fx:          boolean
  web:         boolean
  /** ODP event as `type` + optional `action`; custom types must exist in ODP. */
  odp:         { type: string; action?: string }
}

export const RETAIL_EVENTS: Record<RetailEventKey, RetailEventDef> = {
  product_view:      { description: 'Product detail page viewed',                tags: ['product_id', 'product_name', 'category'],                         fx: true,  web: true,  odp: { type: 'product', action: 'detail' } },
  add_to_cart:       { description: 'Item added to bag (PDP or quick add)',      tags: ['product_id', 'sku', 'quantity', 'currency', 'value', 'source'],   fx: true,  web: true,  odp: { type: 'product', action: 'add_to_cart' } },
  remove_from_cart:  { description: 'Item removed from bag',                     tags: ['product_id', 'sku', 'quantity'],                                  fx: false, web: false, odp: { type: 'product', action: 'remove_from_cart' } },
  wishlist_add:      { description: 'Item saved to wishlist',                    tags: ['product_id'],                                                     fx: true,  web: true,  odp: { type: 'product', action: 'add_to_wishlist' } },
  begin_checkout:    { description: 'Checkout started from the bag',             tags: ['item_count', 'currency', 'value'],                                fx: true,  web: true,  odp: { type: 'checkout', action: 'begin' } },
  add_shipping_info: { description: 'Delivery method chosen (checkout step 2)',  tags: ['shipping_method', 'currency', 'value'],                           fx: true,  web: true,  odp: { type: 'checkout', action: 'shipping' } },
  add_payment_info:  { description: 'Payment submitted (checkout step 3)',       tags: ['currency', 'value'],                                              fx: true,  web: true,  odp: { type: 'checkout', action: 'payment' } },
  purchase:          { description: 'Order placed (revenue in minor units)',     tags: ['order_id', 'revenue', 'value', 'currency', 'item_count', 'utm_source', 'utm_medium', 'utm_campaign'], fx: true,  web: true,  odp: { type: 'order', action: 'purchase' } },
  search:            { description: 'Site search submitted',                     tags: ['search_term', 'result_count'],                                    fx: true,  web: true,  odp: { type: 'navigation', action: 'search' } },
  search_no_results: { description: 'Site search returned nothing',              tags: ['search_term'],                                                    fx: true,  web: true,  odp: { type: 'navigation', action: 'search_no_results' } },
  filter_apply:      { description: 'Product listing filter applied',            tags: ['facet', 'value'],                                                 fx: false, web: true,  odp: { type: 'navigation', action: 'filter' } },
  recs_click:        { description: 'Product recommendation clicked',            tags: ['product_id', 'strategy'],                                         fx: true,  web: true,  odp: { type: 'product', action: 'recommendation_click' } },
  sign_in:           { description: 'Demo persona signed in',                    tags: ['loyalty_tier'],                                                   fx: true,  web: true,  odp: { type: 'account', action: 'login' } },
}

/** Custom ODP customer fields set by the demo sign-in (lib/commerce/identify.ts). */
export const ODP_CUSTOMER_FIELDS = ['loyalty_tier', 'home_city', 'home_country'] as const
