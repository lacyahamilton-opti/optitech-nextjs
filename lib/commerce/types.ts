/**
 * Commerce domain shapes shared by the catalog reader (lib/catalog.ts), the
 * mock-commerce client state (components/commerce/CommerceProvider.tsx) and the
 * commerce UI. These are the ONLY shapes the UI consumes — the Graph external
 * source (PascalCase `ret_*` types) and the local JSON provider both map onto
 * them in lib/catalog.ts, so swapping the data source (seed script → OCP app)
 * never touches a component.
 */

import type { SizeSystem } from '@/lib/commerce/sizes'

export type CurrencyCode = 'USD' | 'GBP' | 'EUR'

export const CURRENCY_CODES: readonly CurrencyCode[] = ['USD', 'GBP', 'EUR']

/** Amounts are integer minor units (cents/pence) — never floats. */
export type Money = {
  currency:  CurrencyCode
  amount:    number
  compareAt: number | null
  /** Set by an FX price treatment (lib/commerce/pricing.ts), e.g. "Reserve price". */
  label?:    string
}

export type Colour = {
  code:   string
  name:   string
  hex:    string
  images: string[]
}

export type Variant = {
  sku:        string
  colourCode: string
  size:       string
  stock:      number
  prices:     Money[]
}

export type ProductGender = 'women' | 'men' | 'unisex'

export type ProductBadge =
  | 'new'
  | 'bestseller'
  | 'limited'
  | 'low-stock'
  | 'signature'
  | 'archive'

export type Product = {
  handle:          string
  styleId:         string
  catalogId:       string
  brand:           string
  name:            string
  description:     string
  gender:          ProductGender
  primaryCategory: string
  categoryHandles: string[]
  collections:     string[]
  badges:          string[]
  materials:       string[]
  care:            string[]
  fit:             string | null
  fitNotes:        string
  traits:          string[]
  rating:          number
  reviewCount:     number
  sortRank:        number
  launchedAt:      string
  url:             string
  colours:         Colour[]
  sizes:           string[]
  variants:        Variant[]
  fromPrices:      Money[]
  pairsWith:       string[]
  /** CMS override of `description` from a handle-scoped PDP template (sanitized HTML). */
  descriptionHtml?: string
}

export type Category = {
  handle:       string
  name:         string
  parentHandle: string | null
  gender:       ProductGender
  url:          string
  sortRank:     number
}

/**
 * A line in the mock bag. The variant's price list is snapshotted at add time
 * (like a real cart), in every currency, so switching locale (en → fr shows
 * EUR) re-prices the bag consistently instead of mixing currencies.
 */
export type CartLine = {
  sku:        string
  handle:     string
  name:       string
  colourName: string
  size:       string
  /** Size convention of the product (lib/commerce/sizes.ts) for market labels. */
  sizeSystem?: SizeSystem
  image:      string | null
  prices:     Money[]
  quantity:   number
}

export type OrderAddress = {
  firstName: string
  lastName:  string
  email:     string
  line1:     string
  city:      string
  postcode:  string
  country:   string
}

export type Order = {
  id:          string
  placedAt:    string
  lines:       CartLine[]
  currency:    CurrencyCode
  subtotal:    number
  shipping:    number
  total:       number
  delivery:    'standard' | 'express' | 'collect'
  /** Shown on the confirmation page only; kept in sessionStorage. No card data is stored. */
  address:     OrderAddress
  /** First-touch acquisition (lib/acquisition.ts), if recorded. */
  acquisition?: { source: string; medium: string; campaign: string }
}

/** Site-level commerce settings, resolved per host from OT_ThemeManager. */
export type CommerceSettings = {
  domain:       string
  catalogId:    string
  currencyCode: CurrencyCode
}
