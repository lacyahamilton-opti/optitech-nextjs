'use client'

import { useMemo, useState, useId } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import MultiSelect from '@/components/ui/MultiSelect'
import ProductCard from '@/components/commerce/ProductCard'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { formatMoney } from '@/lib/commerce/money'
import { FIT_LABELS, TRAIT_LABELS, materialFamilies, priceBands, sortProducts, SORT_KEYS, type SortKey } from '@/lib/commerce/facets'
import { trackFilterApply } from '@/lib/commerce/track'
import type { ProductCardData } from '@/lib/commerce/card'
import type { CurrencyCode } from '@/lib/commerce/types'
import type { MessageKey } from '@/lib/i18n/t'

export type EditorialTile = {
  eyebrow?:  string
  heading:   string
  body?:     string
  ctaLabel?: string
  ctaUrl?:   string
}

type Props = {
  products:      ProductCardData[]
  subCategories: { handle: string; name: string }[]
  currency:      CurrencyCode
  defaultSort:   SortKey
  pageSize:      number
  emptyMessage?: string
  tile?:         EditorialTile
  columns:       3 | 4
  aspect:        'portrait' | 'square'
  showFacets:    boolean
  tilePosition:  number
  onSurface:     boolean
}

type Option = { key: string; label: string }
type Facet = {
  id:      'category' | 'size' | 'colour' | 'material' | 'fit' | 'price' | 'trait'
  options: Option[]
  match:   (p: ProductCardData, keys: Set<string>) => boolean
}

const GRID = { 3: 'grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' } as const

const uniqueInOrder = (values: string[]) => [...new Set(values)]

/**
 * PLP client: facets (OR within a facet, AND across facets — the same model as
 * the practitioner directory), sort, and progressive "show more". Filter state
 * lives in the URL (?category=…&size=…&sort=…) so category nav links like
 * /women?category=women-knitwear deep-link straight into a filtered view, and
 * the back button behaves.
 */
export default function ProductListingClient({
  products, subCategories, currency, defaultSort, pageSize, emptyMessage, tile,
  columns, aspect, showFacets, tilePosition, onSurface,
}: Props) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const sortId = useId()

  // ── Facet definitions, derived from the loaded products ──────────────────
  const facets = useMemo<Facet[]>(() => {
    const catKeys = new Set(products.flatMap((p) => p.categories))
    const bands = priceBands(currency, (m) => formatMoney(m, currency, locale))
    const list: Facet[] = [
      {
        id: 'category',
        options: subCategories.filter((c) => catKeys.has(c.handle)).map((c) => ({ key: c.handle, label: c.name })),
        match: (p, k) => p.categories.some((c) => k.has(c)),
      },
      {
        id: 'size',
        options: uniqueInOrder(products.flatMap((p) => p.sizes)).filter((s) => s !== 'One size').map((s) => ({ key: s, label: s })),
        match: (p, k) => p.inStockSizes.some((s) => k.has(s)),
      },
      {
        id: 'colour',
        options: uniqueInOrder(products.flatMap((p) => p.colours.map((c) => c.name))).sort().map((c) => ({ key: c, label: c })),
        match: (p, k) => p.colours.some((c) => k.has(c.name)),
      },
      {
        id: 'material',
        options: uniqueInOrder(products.flatMap((p) => materialFamilies(p.materials))).sort().map((m) => ({ key: m, label: m })),
        match: (p, k) => materialFamilies(p.materials).some((m) => k.has(m)),
      },
      {
        id: 'fit',
        options: Object.entries(FIT_LABELS).filter(([key]) => products.some((p) => p.fit === key)).map(([key, label]) => ({ key, label })),
        match: (p, k) => !!p.fit && k.has(p.fit),
      },
      {
        id: 'price',
        options: bands.filter((b) => products.some((p) => p.price.amount >= b.min && p.price.amount < b.max)).map((b) => ({ key: b.key, label: b.label })),
        match: (p, k) => bands.some((b) => k.has(b.key) && p.price.amount >= b.min && p.price.amount < b.max),
      },
      {
        id: 'trait',
        options: Object.entries(TRAIT_LABELS).filter(([key]) => products.some((p) => p.traits.includes(key))).map(([key, label]) => ({ key, label })),
        match: (p, k) => p.traits.some((tr) => k.has(tr)),
      },
    ]
    return list.filter((f) => f.options.length > 1)
  }, [products, subCategories, currency, locale])

  // ── State from the URL ────────────────────────────────────────────────────
  const selected = (id: Facet['id']): string[] =>
    (params.get(id) ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const sortParam = params.get('sort') as SortKey | null
  const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : defaultSort

  const writeParams = (mutate: (q: URLSearchParams) => void) => {
    const q = new URLSearchParams(params.toString())
    mutate(q)
    const qs = q.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const setFacet = (id: Facet['id'], keys: string[]) => {
    const before = new Set(selected(id))
    for (const k of keys) if (!before.has(k)) trackFilterApply(id, k)
    writeParams((q) => (keys.length ? q.set(id, keys.join(',')) : q.delete(id)))
  }
  const setSort = (s: SortKey) => writeParams((q) => (s === defaultSort ? q.delete('sort') : q.set('sort', s)))
  const clearAll = () => writeParams((q) => { for (const f of facets) q.delete(f.id) })

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const active = facets.map((f) => ({ f, keys: new Set(selected(f.id)) })).filter((a) => a.keys.size > 0)
  const filtersActive = active.length > 0
  const results = useMemo(
    () => sortProducts(products.filter((p) => active.every(({ f, keys }) => f.match(p, keys))), sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, params, sort, facets],
  )

  // "Show more" count resets whenever the filter/sort signature changes.
  const signature = params.toString()
  const [shown, setShown] = useState({ signature, count: pageSize })
  const count = shown.signature === signature ? shown.count : pageSize
  const visible = results.slice(0, count)
  const showTile = !!tile && !filtersActive && visible.length > tilePosition

  const labelFor = (f: Facet, keys: string[]) => keys.map((k) => f.options.find((o) => o.key === k)?.label ?? k)
  const keysFor = (f: Facet, labels: string[]) => labels.map((l) => f.options.find((o) => o.label === l)?.key ?? l)

  return (
    <div>
      {showFacets && (
        <div className="mb-lg flex flex-col gap-sm border-b border-fg/10 pb-md">
          <div className="flex flex-wrap items-center gap-sm">
            <span className="mr-xs hidden items-center gap-xs text-label uppercase tracking-label font-semibold text-fg sm:inline-flex">
              <SlidersHorizontal size={14} aria-hidden /> {t('commerce.filter')}
            </span>
            {facets.map((f) => (
              <MultiSelect
                key={f.id}
                label={t(`commerce.facet_${f.id}` as MessageKey)}
                options={f.options.map((o) => o.label)}
                selected={labelFor(f, selected(f.id))}
                onChange={(labels) => setFacet(f.id, keysFor(f, labels))}
                onSurface={onSurface}
              />
            ))}
            <div className="ml-auto flex items-center gap-sm">
              <label htmlFor={sortId} className="text-sm text-fg-muted">{t('commerce.sortBy')}</label>
              <select
                id={sortId}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className={`${onSurface ? 'bg-canvas' : 'bg-surface'} h-11 rounded-input border border-fg/15 px-sm text-sm text-fg focus:border-brand focus:outline-none`}
              >
                {SORT_KEYS.map((k) => <option key={k} value={k}>{t(`commerce.sort_${k}` as MessageKey)}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-sm">
            <p className="font-mono text-xs uppercase tracking-label text-fg-muted" aria-live="polite">
              {results.length === 1 ? t('commerce.resultsCountOne') : t('commerce.resultsCount', { count: results.length })}
            </p>
            {active.flatMap(({ f, keys }) =>
              [...keys].map((k) => (
                <button
                  key={`${f.id}-${k}`}
                  type="button"
                  onClick={() => setFacet(f.id, selected(f.id).filter((x) => x !== k))}
                  className="inline-flex items-center gap-1 border border-fg/15 px-2 py-1 text-xs text-fg hover:border-fg/40 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  {f.options.find((o) => o.key === k)?.label ?? k}
                  <X size={12} aria-hidden />
                  <span className="sr-only">remove filter</span>
                </button>
              )),
            )}
            {filtersActive && (
              <button type="button" onClick={clearAll} className="text-xs uppercase tracking-label font-semibold text-fg-muted underline underline-offset-4 hover:text-fg">
                {t('commerce.clearAll')}
              </button>
            )}
          </div>
        </div>
      )}

      {results.length === 0 ? (
        <div className="flex flex-col items-center gap-md py-2xl text-center">
          <p className="text-title font-semibold text-fg">{emptyMessage?.trim() || t('commerce.noResults')}</p>
          {filtersActive && (
            <button type="button" onClick={clearAll} className="btn-signal relative overflow-hidden border border-brand px-md py-sm text-label uppercase tracking-label font-semibold text-brand hover:text-fg-on-brand">
              <span className="relative z-10">{t('commerce.clearAll')}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className={`grid ${GRID[columns]} gap-x-sm gap-y-lg md:gap-x-md`}>
            {visible.map((p, i) => (
              <ProductListItem key={p.handle} product={p} index={i} aspect={aspect}>
                {showTile && i === tilePosition - 1 && tile && <EditorialTileCard tile={tile} aspect={aspect} />}
              </ProductListItem>
            ))}
          </ul>

          {results.length > visible.length && (
            <div className="mt-xl flex flex-col items-center gap-sm">
              <p className="text-sm text-fg-muted">{t('commerce.showingOf', { shown: visible.length, total: results.length })}</p>
              <div className="h-0.5 w-40 overflow-hidden bg-fg/10" aria-hidden>
                <div className="h-full w-full origin-left bg-fg" style={{ transform: `scaleX(${visible.length / results.length})` }} />
              </div>
              <button
                type="button"
                onClick={() => setShown({ signature, count: count + pageSize })}
                className="mt-sm border border-fg/20 px-lg py-3 text-label uppercase tracking-label font-semibold text-fg hover:border-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {t('commerce.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** A grid cell; an editorial tile (when due) is rendered as the NEXT cell. */
function ProductListItem({ product, index, aspect, children }: { product: ProductCardData; index: number; aspect: 'portrait' | 'square'; children?: React.ReactNode }) {
  return (
    <>
      <li className="flex">
        <ProductCard product={product} priority={index < 4} aspect={aspect} />
      </li>
      {children && <li className="flex">{children}</li>}
    </>
  )
}

function EditorialTileCard({ tile, aspect }: { tile: EditorialTile; aspect: 'portrait' | 'square' }) {
  return (
    <div
      data-theme="dark"
      className={`bg-brand-fill flex w-full flex-col justify-end gap-sm p-md text-fg-on-brand md:p-lg ${aspect === 'square' ? 'aspect-square' : 'aspect-4/5'}`}
    >
      {tile.eyebrow && <p className="text-label uppercase tracking-label font-semibold text-fg-on-brand/80">{tile.eyebrow}</p>}
      <p className="text-title font-semibold leading-title text-fg-on-brand text-balance md:text-[1.75rem] md:leading-tight">{tile.heading}</p>
      {tile.body && <p className="text-sm leading-relaxed text-fg-on-brand/85 text-pretty">{tile.body}</p>}
      {tile.ctaLabel && tile.ctaUrl && (
        <a href={tile.ctaUrl} className="mt-xs self-start border-b border-fg-on-brand/60 pb-0.5 text-label uppercase tracking-label font-semibold text-fg-on-brand hover:border-fg-on-brand">
          {tile.ctaLabel}
        </a>
      )}
    </div>
  )
}
