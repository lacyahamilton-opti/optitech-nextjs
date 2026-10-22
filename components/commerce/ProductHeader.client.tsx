'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Heart, Minus, Plus, Star } from 'lucide-react'
import Price from '@/components/commerce/Price'
import { useCommerce } from '@/components/commerce/CommerceProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { localizedHref } from '@/lib/i18n/config'
import { priceIn } from '@/lib/commerce/card'
import { formatMoney, FREE_SHIPPING_THRESHOLD } from '@/lib/commerce/money'
import { trackAddToCart, trackProductView, trackWishlistAdd } from '@/lib/commerce/track'
import { sizeConvention, sizeLabel, sizeSystemFor } from '@/lib/commerce/sizes'
import type { CurrencyCode, Product } from '@/lib/commerce/types'
import type { MessageKey } from '@/lib/i18n/t'

type Props = {
  product:     Product
  /** Currency used when rendered outside a CommerceProvider (showcase/preview). */
  currency:    CurrencyCode
  breadcrumb:  { label: string; href: string }[]
  sizeGuideHref: string
}

const LOW_STOCK = 5

/**
 * The locked top of every product page. Owns colour + size selection and add
 * to bag; everything below it is the editor's Visual Builder composition.
 */
export default function ProductHeaderClient({ product, currency: fallbackCurrency, breadcrumb, sizeGuideHref }: Props) {
  const { t, locale } = useTranslation()
  const commerce = useCommerce()
  const currency = commerce.enabled ? commerce.currency : fallbackCurrency

  const [colourCode, setColourCode] = useState(product.colours[0]?.code ?? '')
  const [size, setSize] = useState<string | null>(product.sizes.length === 1 ? product.sizes[0] : null)
  const [qty, setQty] = useState(1)
  const [needSize, setNeedSize] = useState(false)

  const colour = product.colours.find((c) => c.code === colourCode) ?? product.colours[0]
  const variantsForColour = useMemo(() => product.variants.filter((v) => v.colourCode === colourCode), [product, colourCode])
  const variant = size ? variantsForColour.find((v) => v.size === size) ?? null : null
  const price = priceIn(variant?.prices ?? product.fromPrices, currency)
  const images = colour?.images?.length ? colour.images : product.colours.flatMap((c) => c.images).slice(0, 4)
  const saved = commerce.state.wishlist.includes(product.handle)
  const sizeSystem = sizeSystemFor({ gender: product.gender, categories: product.categoryHandles, sizes: product.sizes })
  const label = (s: string) => sizeLabel(s, sizeSystem, commerce.market)
  const convention = sizeConvention(sizeSystem, commerce.market)

  const { recordView } = commerce
  useEffect(() => {
    recordView(product.handle)
    trackProductView(product.handle, product.name, product.primaryCategory)
  }, [product.handle, product.name, product.primaryCategory, recordView])

  const addToBag = () => {
    if (!variant) { setNeedSize(true); return }
    if (variant.stock <= 0) return
    const line = commerce.addLine({
      sku: variant.sku, handle: product.handle, name: product.name, colourName: colour?.name ?? '',
      size: variant.size, sizeSystem, image: images[0] ?? null, prices: variant.prices,
    }, qty)
    if (line) trackAddToCart(line, currency, priceIn(variant.prices, currency).amount * qty)
  }

  const onHeart = () => { if (commerce.toggleWishlist(product.handle)) trackWishlistAdd(product.handle) }

  const reviewsLabel = t('commerce.reviews', { count: product.reviewCount })
  const soldOut = !!variant && variant.stock <= 0

  return (
    <section className="bg-canvas">
      <div className="mx-auto grid max-w-[96rem] grid-cols-1 gap-lg lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-xl lg:px-lg lg:pt-lg">

        {/* ── Gallery ──────────────────────────────────────────────────────── */}
        <div className="min-w-0">
          {/* Mobile: swipeable, snap-scrolling strip */}
          <div className="flex snap-x snap-mandatory overflow-x-auto lg:hidden [scrollbar-width:none]" aria-label={product.name}>
            {(images.length ? images : [null]).map((src, i) => (
              <div key={src ?? i} className="relative aspect-4/5 w-full flex-none snap-center bg-surface">
                {src && <Image src={src} alt={i === 0 ? `${product.name}, ${colour?.name ?? ''}` : ''} fill priority={i === 0} sizes="100vw" className="object-cover" />}
              </div>
            ))}
          </div>
          {/* Desktop: editorial two-up grid, first image leads full width */}
          <div className="hidden grid-cols-2 gap-xs lg:grid">
            {(images.length ? images : [null]).map((src, i) => (
              <div key={src ?? i} className={`relative bg-surface ${i === 0 && images.length !== 2 ? 'col-span-2 aspect-4/5' : 'aspect-4/5'}`}>
                {src && (
                  <Image
                    src={src}
                    alt={i === 0 ? `${product.name}, ${colour?.name ?? ''}` : ''}
                    fill
                    priority={i === 0}
                    sizes={i === 0 && images.length !== 2 ? '60vw' : '30vw'}
                    className="object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Buy panel ────────────────────────────────────────────────────── */}
        <div className="px-md pb-xl lg:px-0">
          <div className="flex flex-col gap-md lg:sticky lg:top-[calc(var(--ot-site-header-h,5rem)+2rem)]">
            {breadcrumb.length > 0 && (
              <nav aria-label="Breadcrumb">
                <ol className="flex flex-wrap items-center gap-1 text-label uppercase tracking-label text-fg-muted">
                  {breadcrumb.map((b, i) => (
                    <li key={b.href} className="flex items-center gap-1">
                      {i > 0 && <span aria-hidden>/</span>}
                      <a href={b.href} className="hover:text-fg">{b.label}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            <div className="flex items-start justify-between gap-md">
              <h1 className="text-headline font-semibold leading-headline tracking-headline text-fg text-balance">{product.name}</h1>
              {commerce.enabled && (
                <button
                  type="button"
                  onClick={onHeart}
                  aria-pressed={saved}
                  aria-label={t(saved ? 'commerce.removeFromWishlist' : 'commerce.addToWishlist', { name: product.name })}
                  className="mt-1 inline-flex h-11 w-11 flex-none items-center justify-center border border-fg/15 text-fg hover:border-fg/40 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <Heart size={18} strokeWidth={1.75} aria-hidden className={saved ? 'fill-fg' : ''} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-md gap-y-1">
              <Price price={price} locale={locale} size="lg" from={!variant && new Set(product.variants.map((v) => priceIn(v.prices, currency).amount)).size > 1} labels={{ from: t('commerce.from'), was: t('commerce.was'), now: t('commerce.now') }} />
              {product.reviewCount > 0 && (
                <p className="flex items-center gap-1 text-sm text-fg-muted">
                  <Star size={14} aria-hidden className="fill-fg text-fg" />
                  <span className="sr-only">{t('commerce.rated', { rating: product.rating })}</span>
                  <span aria-hidden>{product.rating.toFixed(1)}</span>
                  <span>· {reviewsLabel}</span>
                </p>
              )}
            </div>

            {product.badges.some((b) => ['new', 'limited', 'archive'].includes(b)) && (
              <ul className="flex flex-wrap gap-xs">
                {product.badges.filter((b) => ['new', 'limited', 'archive', 'signature'].includes(b)).map((b) => (
                  <li key={b} className="border border-fg/15 px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-label text-fg">
                    {t(`commerce.badge_${b}` as MessageKey)}
                  </li>
                ))}
              </ul>
            )}

            {/* Colour */}
            {product.colours.length > 0 && (
              <fieldset>
                <legend className="mb-sm text-sm text-fg">
                  <span className="text-fg-muted">{t('commerce.colour')}: </span>{colour?.name}
                </legend>
                <div className="flex flex-wrap gap-sm">
                  {product.colours.map((c) => (
                    <label key={c.code} className="relative cursor-pointer" title={c.name}>
                      <input type="radio" name={`colour-${product.handle}`} value={c.code} checked={c.code === colourCode} onChange={() => setColourCode(c.code)} className="peer sr-only" />
                      <span
                        className="block h-9 w-9 border border-fg/20 outline-offset-2 peer-checked:outline peer-checked:outline-2 peer-checked:outline-fg peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="sr-only">{c.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Size */}
            <fieldset aria-describedby={needSize && !size ? `size-error-${product.handle}` : undefined}>
              <legend className="mb-sm flex w-full items-center justify-between text-sm text-fg">
                <span><span className="text-fg-muted">{t('commerce.size')}{convention ? ` (${convention})` : ''}: </span>{size ? label(size) : '—'}</span>
                <a href={sizeGuideHref} className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg">{t('commerce.sizeGuide')}</a>
              </legend>
              <div className="grid grid-cols-4 gap-xs sm:grid-cols-5">
                {product.sizes.map((s) => {
                  const v = variantsForColour.find((x) => x.size === s)
                  const out = !v || v.stock <= 0
                  return (
                    <label key={s} className={out ? 'cursor-not-allowed' : 'cursor-pointer'}>
                      <input
                        type="radio"
                        name={`size-${product.handle}`}
                        value={s}
                        checked={size === s}
                        disabled={out}
                        onChange={() => { setSize(s); setNeedSize(false) }}
                        className="peer sr-only"
                      />
                      <span
                        className={[
                          'flex h-11 items-center justify-center border text-sm tabular-nums',
                          'motion-safe:transition-colors duration-150 ease-quick',
                          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand',
                          out
                            ? 'border-fg/10 text-fg-muted/60 line-through'
                            : 'border-fg/20 text-fg hover:border-fg peer-checked:border-fg peer-checked:bg-fg peer-checked:text-canvas',
                        ].join(' ')}
                      >
                        {label(s)}
                        {out && <span className="sr-only"> — {t('commerce.soldOut')}</span>}
                      </span>
                    </label>
                  )
                })}
              </div>
              {needSize && !size && (
                <p id={`size-error-${product.handle}`} className="mt-sm text-sm text-fg" role="alert">{t('commerce.selectSize')}</p>
              )}
              {variant && variant.stock > 0 && variant.stock <= LOW_STOCK && (
                <p className="mt-sm text-sm text-fg">{t('commerce.onlyLeft', { count: variant.stock })}</p>
              )}
            </fieldset>

            {/* Quantity + add to bag */}
            <div className="flex gap-sm">
              <div className="inline-flex items-center border border-fg/20" role="group" aria-label={t('commerce.quantity')}>
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t('commerce.decrease')} className="inline-flex h-12 w-10 items-center justify-center text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
                  <Minus size={14} aria-hidden />
                </button>
                <span className="w-6 text-center tabular-nums text-fg" aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label={t('commerce.increase')} className="inline-flex h-12 w-10 items-center justify-center text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
                  <Plus size={14} aria-hidden />
                </button>
              </div>
              <button
                type="button"
                onClick={addToBag}
                disabled={soldOut}
                className="btn-signal relative flex h-12 flex-1 items-center justify-center overflow-hidden bg-brand text-label font-semibold uppercase tracking-label text-fg-on-brand disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand"
              >
                <span className="relative z-10">
                  {soldOut ? t('commerce.soldOut') : `${t('commerce.addToBag')} · ${formatMoney(price.amount * qty, price.currency, locale)}`}
                </span>
              </button>
            </div>

            <p className="text-sm text-fg-muted">
              {t('commerce.deliveryCopy', { amount: formatMoney(FREE_SHIPPING_THRESHOLD, currency, locale) })}
            </p>

            {/* Details — native disclosure: keyboard + screen reader support with no JS */}
            <div className="mt-sm divide-y divide-fg/10 border-y border-fg/10">
              {[
                { key: 'details', title: t('commerce.details'), body: <>{product.descriptionHtml
                  // Sanitized server-side in lib/commerce/pdp.ts (CMS rich text).
                  ? <div data-rich-text="" data-size="compact" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
                  : <p>{product.description}</p>}<p className="mt-sm text-fg-muted">{t('commerce.styleNo', { id: product.styleId })}</p></>, open: true },
                { key: 'fit', title: t('commerce.fit'), body: <p>{product.fitNotes}</p> },
                { key: 'materials', title: t('commerce.materials'), body: <ul className="list-disc pl-5">{[...product.materials, ...product.care].map((m) => <li key={m}>{m}</li>)}</ul> },
                { key: 'delivery', title: t('commerce.deliveryReturns'), body: <p>{t('commerce.deliveryCopy', { amount: formatMoney(FREE_SHIPPING_THRESHOLD, currency, locale) })}</p> },
              ].map((s) => (
                <details key={s.key} className="group/d" open={s.open}>
                  <summary className="flex cursor-pointer list-none items-center justify-between py-md text-label uppercase tracking-label font-semibold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                    {s.title}
                    <Plus size={16} aria-hidden className="motion-safe:transition-transform duration-200 group-open/d:rotate-45" />
                  </summary>
                  <div className="pb-md text-body leading-body text-fg text-pretty">{s.body}</div>
                </details>
              ))}
            </div>

            <a href={localizedHref('/stores', locale)} className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg">
              {t('commerce.checkInStore')}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
