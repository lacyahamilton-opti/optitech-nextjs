import type { Market } from '@/lib/commerce/market'

/**
 * Market-specific size labels. The catalog stores one size per variant (the
 * SKU key: US letters / US numeric for womenswear, chest inches for men's
 * tailoring, EU for footwear); shoppers see the convention of their market
 * (lib/commerce/market.ts). Waist, belt, letter menswear and one-size labels
 * are the same everywhere and pass through unchanged.
 */
export type SizeSystem = 'women-alpha' | 'women-us' | 'men-chest' | 'shoe-eu-w' | 'shoe-eu-m' | 'plain'

const WOMEN_ALPHA: Record<string, { uk: string; eu: string }> = {
  XS: { uk: '6', eu: '34' }, S: { uk: '8', eu: '36' }, M: { uk: '10', eu: '38' }, L: { uk: '12', eu: '40' }, XL: { uk: '14', eu: '42' },
}
const SHOE_UK: Record<string, string> = { 36: '3.5', 37: '4', 38: '5', 39: '6', 40: '6.5', 41: '7.5', 42: '8', 43: '9', 44: '9.5', 45: '10.5', 46: '11' }
const SHOE_US_W: Record<string, string> = { 36: '6', 37: '6.5', 38: '7.5', 39: '8.5', 40: '9', 41: '10', 42: '10.5' }
const SHOE_US_M: Record<string, string> = { 40: '7', 41: '8', 42: '8.5', 43: '9.5', 44: '10', 45: '11', 46: '12' }

const num = (s: string) => (/^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN)

/** Work out a product's size system from its gender, categories and sizes. */
export function sizeSystemFor(p: { gender: string; categories: string[]; sizes: string[] }): SizeSystem {
  const nums = p.sizes.map(num)
  const allNum = nums.length > 0 && nums.every((n) => !Number.isNaN(n))
  if (p.categories.includes('accessories-footwear') && allNum) return Math.min(...nums) <= 37 ? 'shoe-eu-w' : 'shoe-eu-m'
  if (p.gender === 'women' && p.sizes.every((s) => s in WOMEN_ALPHA)) return 'women-alpha'
  if (p.gender === 'women' && allNum && Math.max(...nums) <= 16) return 'women-us'
  if (p.gender === 'men' && p.categories.includes('men-tailoring') && allNum) return 'men-chest'
  return 'plain'
}

/** The label to show for catalog `size` in `market`. */
export function sizeLabel(size: string, system: SizeSystem | undefined, market: Market): string {
  const n = num(size)
  switch (system) {
    case 'women-alpha': return market === 'default' ? size : (WOMEN_ALPHA[size]?.[market] ?? size)
    case 'women-us':    return market === 'uk' ? String(n + 4) : market === 'eu' ? String(n + 32) : size
    case 'men-chest':   return market === 'eu' ? String(n + 10) : size
    case 'shoe-eu-w':   return market === 'uk' ? (SHOE_UK[size] ?? size) : market === 'eu' ? size : (SHOE_US_W[size] ?? size)
    case 'shoe-eu-m':   return market === 'uk' ? (SHOE_UK[size] ?? size) : market === 'eu' ? size : (SHOE_US_M[size] ?? size)
    default:            return size
  }
}

/** Short name of the size convention shown, e.g. "UK", or null when unchanged. */
export function sizeConvention(system: SizeSystem | undefined, market: Market): string | null {
  if (!system || system === 'plain') return null
  if (market === 'uk') return 'UK'
  if (market === 'eu') return system === 'men-chest' || system === 'women-alpha' || system === 'women-us' || system.startsWith('shoe') ? 'EU' : null
  return system.startsWith('shoe') ? 'US' : null
}
