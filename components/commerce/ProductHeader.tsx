import ProductHeaderClient from '@/components/commerce/ProductHeader.client'
import { getCategories } from '@/lib/catalog'
import { localizedHref, type Locale } from '@/lib/i18n/config'
import type { CurrencyCode, Product } from '@/lib/commerce/types'

type Props = {
  product:  Product
  currency: CurrencyCode
  locale:   Locale
}

/**
 * Server shell for the locked product header: resolves the category
 * breadcrumb from the catalog (category → CMS page URL) and hands the product
 * to the client component that owns selection and add-to-bag.
 */
export default async function ProductHeader({ product, currency, locale }: Props) {
  const categories = await getCategories(product.catalogId)
  const byHandle = new Map(categories.map((c) => [c.handle, c]))
  const primary = byHandle.get(product.primaryCategory)
  const parent = primary?.parentHandle ? byHandle.get(primary.parentHandle) : null
  const breadcrumb = [parent, primary]
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({ label: c.name, href: localizedHref(c.url, locale) }))

  return (
    <ProductHeaderClient
      product={product}
      currency={currency}
      breadcrumb={breadcrumb}
      sizeGuideHref={localizedHref('/help/size-and-fit', locale)}
    />
  )
}
