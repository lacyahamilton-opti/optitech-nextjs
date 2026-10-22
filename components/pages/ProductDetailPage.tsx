import ProductHeader from '@/components/commerce/ProductHeader'
import JsonLd from '@/components/seo/JsonLd'
import { CompositionRenderer } from '@/lib/CompositionRenderer'
import { buildJsonLd } from '@/lib/structured-data'
import { setPdpProduct } from '@/lib/commerce/pdp-context'
import { priceIn } from '@/lib/commerce/card'
import type { PageSeoFields, SiteMetaSettings } from '@/lib/metadata'
import type { CurrencyCode, Product } from '@/lib/commerce/types'
import type { Locale } from '@/lib/i18n/config'

type Props = {
  product:  Product
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  template: any | null
  currency: CurrencyCode
  locale:   Locale
  site:     SiteMetaSettings
  pageUrl:  string
}

/** Product JSON-LD fields from a catalog product (one Offer per SKU in `currency`). */
export function productSeo(product: Product, currency: CurrencyCode): NonNullable<PageSeoFields['product']> {
  return {
    name:        product.name,
    description: product.description,
    sku:         product.styleId,
    brand:       product.brand,
    images:      product.colours.flatMap((c) => c.images).slice(0, 6),
    rating:      product.rating,
    reviewCount: product.reviewCount,
    offers:      product.variants.map((v) => ({
      sku: v.sku, price: priceIn(v.prices, currency).amount, currency, inStock: v.stock > 0,
    })),
  }
}

/**
 * A catalog product page: the locked ProductHeader (data from the Graph
 * catalog) above the matching OT_ProductDetailTemplate's Visual Builder
 * composition. The current product is published to the request-scoped PDP
 * context first, so template blocks (Complete the look recs) can read it.
 */
export default function ProductDetailPage({ product, template, currency, locale, site, pageUrl }: Props) {
  setPdpProduct(product)
  const jsonLd = buildJsonLd(
    { ...(template ?? {}), schemaType: 'Product', product: productSeo(product, currency) } as PageSeoFields,
    site,
    pageUrl,
  )

  return (
    <>
      <JsonLd data={jsonLd} />
      <ProductHeader product={product} currency={currency} locale={locale} />
      {template?.composition?.nodes && <CompositionRenderer nodes={template.composition.nodes} />}
    </>
  )
}
