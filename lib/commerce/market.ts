import type { CurrencyCode } from '@/lib/commerce/types'

/**
 * Shopping market — what currency and size labels a shopper sees. Derived from
 * the URL locale plus one optional cookie, so no new URL prefix is needed:
 *
 *   default  English, site currency (USD for Apple & Ivey), catalog sizes (US)
 *   uk       English (UK) — chosen in the locale selector; GBP, UK sizes
 *   eu       /fr, /de, /es — EUR, EU sizes
 *
 * Shared by server (lib/commerce/settings.ts) and client (selector, size labels).
 */
export type Market = 'default' | 'uk' | 'eu'

export const MARKET_COOKIE = 'ot_market'

export function marketFor(locale: string, marketCookie?: string | null): Market {
  if (locale === 'fr' || locale === 'de' || locale === 'es') return 'eu'
  return marketCookie === 'uk' ? 'uk' : 'default'
}

export function currencyForMarket(siteCurrency: CurrencyCode, market: Market): CurrencyCode {
  if (market === 'uk') return 'GBP'
  if (market === 'eu') return 'EUR'
  return siteCurrency
}

/** Browser: write or clear the market cookie (1 year). */
export function writeMarketCookie(market: 'uk' | null): void {
  try {
    document.cookie = market
      ? `${MARKET_COOKIE}=${market}; path=/; max-age=31536000; SameSite=Lax`
      : `${MARKET_COOKIE}=; path=/; max-age=0; SameSite=Lax`
  } catch { /* ignore */ }
}

/** Browser: the market cookie's value. */
export function readMarketCookie(): string | null {
  if (typeof document === 'undefined') return null
  const hit = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${MARKET_COOKIE}=`))
  return hit ? hit.slice(MARKET_COOKIE.length + 1) : null
}
