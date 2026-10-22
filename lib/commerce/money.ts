import type { CurrencyCode } from '@/lib/commerce/types'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' }

/**
 * Formats integer minor units as a localized price. Whole amounts drop the
 * decimals ("$520", "485 €"), which is how premium retail displays prices.
 */
export function formatMoney(amountMinor: number, currency: CurrencyCode, locale = 'en'): string {
  const whole = amountMinor % 100 === 0
  return new Intl.NumberFormat(LOCALE_TAGS[locale] ?? 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amountMinor / 100)
}

/** Flat-rate mock shipping, free over a threshold (minor units). */
export const SHIPPING = {
  standard: { label: 'Standard (3–5 days)', amount: 1000 },
  express:  { label: 'Express (next day)',  amount: 2500 },
  collect:  { label: 'Collect in store',    amount: 0 },
} as const

export const FREE_SHIPPING_THRESHOLD = 25000
