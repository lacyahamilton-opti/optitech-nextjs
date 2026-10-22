import CatalogRecommendationsClient from './CatalogRecommendationsClient'
import type { ProductCardData } from '@/lib/commerce/card'
import type { ProductRecColor } from './ProductRecommendationsClient'

export type CatalogRecommendationsProps = {
  heading?:     string
  subheading?:  string
  color?:       ProductRecColor
  count:        number
  initial?:     ProductCardData[]
  dynamic?:     'recentlyViewed' | 'nextBest'
  exclude?:     string
  /** Recommendation strategy, reported with recs_click events. */
  strategy?:    string
  pa?:          (prop: string) => Record<string, unknown>
}

const BG_CLASS: Record<ProductRecColor, string> = {
  canvas:  'bg-canvas',
  surface: 'bg-surface',
  brand:   'bg-brand-fill',
}

/**
 * Catalog-sourced variant of the Product Recommendations block (source =
 * catalog). The Peerius variant (ProductRecommendationsBlock) is untouched.
 * The heading is passed into the client row so an empty session strategy hides
 * the whole shelf, heading included.
 */
export default function CatalogRecommendations({
  heading, subheading, color = 'canvas', count, initial, dynamic, exclude, strategy, pa = () => ({}),
}: CatalogRecommendationsProps) {
  const onBrand = color === 'brand'
  if (!dynamic && !initial?.length) return null

  // Keyed: this element crosses the server→client boundary as a prop and is
  // rendered beside the product list there, so React dev validates it as one.
  const header = (heading || subheading) ? (
    <div key="recs-header" className="mb-lg flex max-w-3xl flex-col gap-xs">
      {heading && (
        <h2 className={`text-title font-semibold leading-title tracking-headline md:text-[1.75rem] md:leading-tight ${onBrand ? 'text-fg-on-brand' : 'text-fg'}`} {...pa('heading')}>
          {heading}
        </h2>
      )}
      {subheading && (
        <p className={`text-body ${onBrand ? 'text-fg-on-brand/75' : 'text-fg-muted'}`} {...pa('subheading')}>{subheading}</p>
      )}
    </div>
  ) : null

  return (
    <section className={`${BG_CLASS[color]} px-md py-xl lg:px-lg [&:not(:has(li))]:hidden`} {...(onBrand ? { 'data-theme': 'dark' } : {})}>
      <div className="mx-auto max-w-[96rem]">
        <CatalogRecommendationsClient initial={initial} dynamic={dynamic} exclude={exclude} strategy={strategy ?? dynamic ?? 'manual'} count={count} header={header} onBrand={onBrand} />
      </div>
    </section>
  )
}
