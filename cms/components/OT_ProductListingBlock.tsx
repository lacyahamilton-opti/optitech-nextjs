import { draftMode } from 'next/headers'
import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_ProductListingBlock as OT_ProductListingBlockContentType } from '@/cms/content-types/OT_ProductListingBlock'
import { getProductListingStyles } from '@/cms/styling/OT_ProductListingBlock.styling'
import ProductListingBlock from '@/components/blocks/ProductListingBlock'
import { getRequestDomain, getRequestLocale } from '@/lib/optimizely'
import { getCategories, getProducts, isValidHandle } from '@/lib/catalog'
import { getCommerceSettings, currencyForLocale, getMarketCookie } from '@/lib/commerce/settings'
import { toCardData } from '@/lib/commerce/card'
import { withPricing } from '@/lib/commerce/pricing'
import type { SortKey } from '@/lib/commerce/facets'
import { resolveCmsUrl } from '@/lib/resolveCmsUrl'

type Props = {
  content:          ContentProps<typeof OT_ProductListingBlockContentType>
  displaySettings?: Record<string, string | boolean>
}

// Async server component. Loads the scoped product set from the Graph catalog
// (React-cached per request) and maps it to compact card data; facets, sort and
// "show more" run client-side over that set.
export default async function OT_ProductListingBlockAdapter({ content, displaySettings = {} }: Props) {
  const { pa } = getPreviewUtils(content)
  const styleOptions = getProductListingStyles(displaySettings)
  const [domain, locale] = await Promise.all([getRequestDomain(), getRequestLocale()])
  const commerce = await getCommerceSettings(domain)

  if (!commerce) {
    const { isEnabled } = await draftMode()
    return isEnabled ? (
      <div {...pa(content.__composition)} className="w-full px-md py-lg text-sm text-fg-muted">
        Product Listing: mock commerce is not enabled for this site (ThemeManager → Integrations → Enable Mock Commerce).
      </div>
    ) : null
  }

  const category = content.categoryHandle?.trim() && isValidHandle(content.categoryHandle.trim()) ? content.categoryHandle.trim() : undefined
  const collection = content.collection && content.collection !== 'all' ? content.collection : undefined
  const badge = content.badge && content.badge !== 'any' ? content.badge : undefined
  const currency = currencyForLocale(commerce, locale, await getMarketCookie())

  const [products, categories] = await Promise.all([
    getProducts(commerce.catalogId, { category, collection, badge }).then(withPricing),
    getCategories(commerce.catalogId),
  ])
  const cards = products.map((p) => toCardData(p, currency))
  // Sub-categories of the listed category become the Category facet.
  const subCategories = categories
    .filter((c) => (category ? c.parentHandle === category : c.parentHandle === null))
    .map((c) => ({ handle: c.handle, name: c.name }))

  const tile = content.tileHeading
    ? {
        eyebrow:  content.tileEyebrow ?? undefined,
        heading:  content.tileHeading,
        body:     content.tileBody ?? undefined,
        ctaLabel: content.tileCtaLabel ?? undefined,
        ctaUrl:   resolveCmsUrl(content.tileCtaUrl),
      }
    : undefined

  return (
    <div {...pa(content.__composition)} className="w-full">
      <ProductListingBlock
        heading={content.heading ?? undefined}
        subtext={content.subtext ?? undefined}
        products={cards}
        subCategories={subCategories}
        currency={currency}
        defaultSort={(content.defaultSort as SortKey | undefined) ?? 'featured'}
        pageSize={Number(content.pageSize) || 12}
        emptyMessage={content.emptyMessage ?? undefined}
        tile={tile}
        styleOptions={styleOptions}
        pa={pa}
      />
    </div>
  )
}
