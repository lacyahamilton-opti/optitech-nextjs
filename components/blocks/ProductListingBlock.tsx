import { Suspense } from 'react'
import ProductListingClient, { type EditorialTile } from './ProductListingBlock.client'
import ProductCard from '@/components/commerce/ProductCard'
import type { ProductCardData } from '@/lib/commerce/card'
import type { CurrencyCode } from '@/lib/commerce/types'
import type { SortKey } from '@/lib/commerce/facets'
import type { ProductListingStyleOptions } from '@/cms/styling/OT_ProductListingBlock.styling'

export type { EditorialTile }

export type ProductListingBlockProps = {
  heading?:       string
  subtext?:       string
  products:       ProductCardData[]
  subCategories:  { handle: string; name: string }[]
  currency:       CurrencyCode
  defaultSort?:   SortKey
  pageSize?:      number
  emptyMessage?:  string
  tile?:          EditorialTile
  styleOptions:   ProductListingStyleOptions
  /** Preview-attribute factory from getPreviewUtils — server context only. */
  pa?:            (prop: string) => Record<string, unknown>
}

const GRID = { 3: 'grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' } as const

// Server wrapper (no 'use client'): heading + subtext render server-side with
// preview attributes and are indexable. The client listing reads filter state
// from the URL (useSearchParams), so it sits in a Suspense boundary whose
// fallback is the first page of products rendered statically — crawlers and
// the prerendered showcase still get real product markup.
export default function ProductListingBlock({
  heading,
  subtext,
  products,
  subCategories,
  currency,
  defaultSort = 'featured',
  pageSize = 12,
  emptyMessage,
  tile,
  styleOptions,
  pa = () => ({}),
}: ProductListingBlockProps) {
  const bg = styleOptions.color === 'surface' ? 'bg-surface' : 'bg-canvas'

  return (
    <section className={`${bg} px-md py-lg lg:px-lg lg:py-xl`}>
      <div className="mx-auto max-w-[96rem]">
        {(heading || subtext) && (
          <header className="mb-lg max-w-(--ot-measure)">
            {heading && (
              <h2 className="text-headline leading-headline tracking-headline font-semibold text-fg text-balance" {...pa('heading')}>
                {heading}
              </h2>
            )}
            {subtext && (
              <p className="mt-sm text-body leading-body text-fg-muted text-pretty" {...pa('subtext')}>{subtext}</p>
            )}
          </header>
        )}

        <Suspense
          fallback={
            <ul className={`grid ${GRID[styleOptions.columns]} gap-x-sm gap-y-lg md:gap-x-md`}>
              {products.slice(0, pageSize).map((p, i) => (
                <li key={p.handle} className="flex">
                  <ProductCard product={p} priority={i < 4} aspect={styleOptions.cardAspect} />
                </li>
              ))}
            </ul>
          }
        >
          <ProductListingClient
            products={products}
            subCategories={subCategories}
            currency={currency}
            defaultSort={defaultSort}
            pageSize={pageSize}
            emptyMessage={emptyMessage}
            tile={tile}
            columns={styleOptions.columns}
            aspect={styleOptions.cardAspect}
            showFacets={styleOptions.showFacets}
            tilePosition={styleOptions.tilePosition}
            onSurface={styleOptions.color === 'surface'}
          />
        </Suspense>
      </div>
    </section>
  )
}
