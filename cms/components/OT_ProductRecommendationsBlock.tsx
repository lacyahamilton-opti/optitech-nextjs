import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_ProductRecommendationsBlock as OT_ProductRecommendationsBlockContentType } from '@/cms/content-types/OT_ProductRecommendationsBlock'
import ProductRecommendationsBlock from '@/components/blocks/ProductRecommendationsBlock'
import CatalogRecommendations from '@/components/blocks/CatalogRecommendations'
import type { ProductRecColor } from '@/components/blocks/ProductRecommendationsBlock'
import { getRequestDomain, getRequestLocale } from '@/lib/optimizely'
import { getCommerceSettings, currencyForLocale, getMarketCookie } from '@/lib/commerce/settings'
import { isRecStrategy, recommend } from '@/lib/commerce/recommend'
import { getPdpProduct } from '@/lib/commerce/pdp-context'
import { toCardData } from '@/lib/commerce/card'
import { withPricing } from '@/lib/commerce/pricing'

type Props = {
  content:          ContentProps<typeof OT_ProductRecommendationsBlockContentType>
  displaySettings?: Record<string, string | boolean>
}

// Two sources:
//   peerius (default / blank) — live-only, no server fetch: the Peerius engine
//     (script injected in app/layout.tsx when configured) fires recommendations
//     client-side and the widget listens for `peerius:recs`. Unchanged.
//   catalog — merchandising strategies over the Graph product catalog
//     (lib/commerce/recommend.ts), for sites with mock commerce enabled.

export default async function OT_ProductRecommendationsBlockAdapter({
  content,
  displaySettings = {},
}: Props) {
  const { pa } = getPreviewUtils(content)

  const initialCount = Number(content.initialCount) || 3
  const color = String(displaySettings.color ?? 'canvas') as ProductRecColor

  if (content.source === 'catalog') {
    const [domain, locale] = await Promise.all([getRequestDomain(), getRequestLocale()])
    const commerce = await getCommerceSettings(domain)
    if (!commerce) return null
    const strategy = isRecStrategy(content.strategy) ? content.strategy : 'trending'
    const count = Math.max(initialCount, 4)
    const pdpProduct = getPdpProduct()
    const currency = currencyForLocale(commerce, locale, await getMarketCookie())

    const dynamic = strategy === 'recentlyViewed' || strategy === 'nextBest' ? strategy : undefined
    const initial = dynamic
      ? undefined
      : (await recommend({
          catalogId: commerce.catalogId,
          strategy,
          seeds: strategy === 'completeTheLook'
            ? (pdpProduct ? [pdpProduct.handle] : [])
            : (content.productHandles ?? '').split(',').map((h) => h.trim()).filter(Boolean),
          category: content.categoryHandle?.trim() || undefined,
          exclude: pdpProduct ? [pdpProduct.handle] : [],
          limit: count,
        }).then(withPricing)).map((p) => toCardData(p, currency))

    return (
      <div {...pa(content.__composition)} className="w-full">
        <CatalogRecommendations
          heading={content.heading ?? undefined}
          subheading={content.subheading ?? undefined}
          color={color}
          count={count}
          initial={initial}
          dynamic={dynamic}
          strategy={strategy}
          exclude={pdpProduct?.handle}
          pa={pa}
        />
      </div>
    )
  }

  return (
    <div {...pa(content.__composition)} className="w-full">
      <ProductRecommendationsBlock
        heading={content.heading ?? undefined}
        subheading={content.subheading ?? undefined}
        widgetPosition={content.widgetPosition ?? undefined}
        initialCount={initialCount}
        showAllLabel={content.showAllLabel ?? 'Show all'}
        color={color}
        pa={pa}
      />
    </div>
  )
}
