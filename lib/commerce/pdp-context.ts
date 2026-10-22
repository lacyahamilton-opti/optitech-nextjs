import 'server-only'
import { cache } from 'react'
import type { Product } from '@/lib/commerce/types'

/**
 * Request-scoped "current product" for blocks rendered inside a product detail
 * template (e.g. Product Recommendations → Complete the look). The PDP sets it
 * before rendering the composition; blocks read it without prop drilling
 * through the Visual Builder tree. React cache() gives one mutable slot per
 * server request, so concurrent requests never see each other's product.
 */
const slot = cache(() => ({ product: null as Product | null }))

export function setPdpProduct(product: Product | null): void {
  slot().product = product
}

export function getPdpProduct(): Product | null {
  return slot().product
}
