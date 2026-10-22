import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { getClient, getRequestDomain } from '@/lib/optimizely'
import { CURRENCY_CODES, type CommerceSettings, type CurrencyCode } from '@/lib/commerce/types'
import { BAG_COUNT_COOKIE } from '@/lib/commerce/storage'
import { MARKET_COOKIE, currencyForMarket, marketFor, type Market } from '@/lib/commerce/market'

/**
 * Per-site mock-commerce switch.
 *
 * Deliberately a SEPARATE Graph query from lib/optimizely.ts THEME_QUERY: the
 * theme query feeds every site's layout/header/footer, and it swallows errors by
 * returning []. Adding the commerce fields there would mean a Graph schema lag
 * (fields pushed but not yet indexed) blanks the theme for ALL sites. Here, any
 * error or a missing/false `enableCommerce` just yields null — the site renders
 * exactly as it did before commerce existed.
 */
const COMMERCE_QUERY = `
  query GetCommerceSettings {
    OT_ThemeManager(limit: 100) {
      items { frontEndDomain enableCommerce catalogId currencyCode }
    }
  }
`

type CommerceRow = {
  frontEndDomain?: string | null
  enableCommerce?: boolean | null
  catalogId?: string | null
  currencyCode?: string | null
}

const fetchAll = cache(async (): Promise<CommerceRow[]> => {
  try {
    const data = await getClient().request(COMMERCE_QUERY, {})
    return ((data as { OT_ThemeManager?: { items?: CommerceRow[] } })?.OT_ThemeManager?.items ?? [])
  } catch {
    return []
  }
})

/** Commerce settings for `domain`, or null when commerce is off/unknown for it. */
export const getCommerceSettings = cache(async (domain: string): Promise<CommerceSettings | null> => {
  if (!domain) return null
  const row = (await fetchAll()).find((r) => r.frontEndDomain === domain && r.enableCommerce === true)
  if (!row) return null
  const currency = (CURRENCY_CODES as readonly string[]).includes(row.currencyCode ?? '')
    ? (row.currencyCode as CurrencyCode)
    : 'USD'
  return { domain, catalogId: row.catalogId?.trim() || 'apparel', currencyCode: currency }
})

/** Commerce settings for the current request's host. */
export async function getRequestCommerceSettings(): Promise<CommerceSettings | null> {
  return getCommerceSettings(await getRequestDomain())
}

/**
 * Display currency for a locale + market cookie (lib/commerce/market.ts):
 * fr/de/es shoppers see EUR, English (UK) sees GBP, English uses the site
 * currency. Pass the request's `ot_market` cookie (see getMarketCookie).
 */
export function currencyForLocale(settings: CommerceSettings, locale: string, marketCookie?: string | null): CurrencyCode {
  return currencyForMarket(settings.currencyCode, marketFor(locale, marketCookie))
}

/** The request's `ot_market` cookie (server components). */
export async function getMarketCookie(): Promise<string | null> {
  try { return (await cookies()).get(MARKET_COOKIE)?.value ?? null } catch { return null }
}

/** The request's market (server components). */
export async function getRequestMarket(locale: string): Promise<Market> {
  return marketFor(locale, await getMarketCookie())
}

/**
 * What the header needs: whether to render the bag/wishlist icons, and the bag
 * count from the ot_bag_count cookie so the badge renders server-side without
 * a flash before the client store hydrates.
 */
export async function getHeaderCommerce(domain: string): Promise<{ enabled: boolean; bagCount: number }> {
  const settings = await getCommerceSettings(domain)
  if (!settings) return { enabled: false, bagCount: 0 }
  let bagCount = 0
  try {
    const raw = (await cookies()).get(BAG_COUNT_COOKIE)?.value
    const n = Number.parseInt(raw ?? '0', 10)
    bagCount = Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 0
  } catch { /* outside a request */ }
  return { enabled: true, bagCount }
}
