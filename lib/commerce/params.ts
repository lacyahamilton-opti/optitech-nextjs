import { CURRENCY_CODES, type CurrencyCode } from '@/lib/commerce/types'

/** Validates an untrusted currency param against the supported list. */
export function parseCurrency(value: string | null | undefined, fallback: CurrencyCode): CurrencyCode {
  return value && (CURRENCY_CODES as readonly string[]).includes(value) ? (value as CurrencyCode) : fallback
}
