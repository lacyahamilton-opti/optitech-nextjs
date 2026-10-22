'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Heart, Plus, X } from 'lucide-react'
import Price from '@/components/commerce/Price'
import { useCommerce } from '@/components/commerce/CommerceProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { localizedHref } from '@/lib/i18n/config'
import { trackAddToCart, trackWishlistAdd } from '@/lib/commerce/track'
import { sizeConvention, sizeLabel, sizeSystemFor } from '@/lib/commerce/sizes'
import { priceIn } from '@/lib/commerce/card'
import type { ProductCardData } from '@/lib/commerce/card'
import type { MessageKey } from '@/lib/i18n/t'

const MAX_SWATCHES = 4

type Props = {
  product:   ProductCardData
  /** Above-the-fold cards load eagerly. */
  priority?: boolean
  /** Image aspect ratio. Portrait (4:5) is the retail default. */
  aspect?:   'portrait' | 'square'
  sizes?:    string
}

/**
 * The storefront's product tile — used by the PLP, catalog recommendations and
 * the wishlist. Deliberately quiet: image-led, one line of name, one of price,
 * swatches as small dots. The second image crossfades in on hover (opacity
 * only, motion-safe). The wishlist heart and Quick Add are real buttons
 * layered over the link (not nested in it). Quick Add appears on hover/focus
 * (always on touch screens): one-size pieces go straight to the bag, others
 * open an inline size row.
 */
export default function ProductCard({ product, priority = false, aspect = 'portrait', sizes }: Props) {
  const { t, locale } = useTranslation()
  const { enabled, state, toggleWishlist, addLine, currency, market } = useCommerce()
  const saved = state.wishlist.includes(product.handle)
  const href = localizedHref(product.url, locale)
  const badge = product.badges.find((b) => b !== 'signature') ?? null
  const sizeSystem = sizeSystemFor(product)
  const convention = sizeConvention(sizeSystem, market)
  const extraSwatches = product.colours.length - MAX_SWATCHES

  const onHeart = () => {
    if (toggleWishlist(product.handle)) trackWishlistAdd(product.handle)
  }

  // ── Quick Add ──────────────────────────────────────────────────────────────
  const quick = enabled ? product.quick : null
  const [picking, setPicking] = useState(false)
  const quickRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstSizeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!picking) return
    firstSizeRef.current?.focus()
    const close = () => { setPicking(false); triggerRef.current?.focus() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onDown = (e: MouseEvent) => { if (!quickRef.current?.contains(e.target as Node)) setPicking(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [picking])

  const addVariant = (v: NonNullable<typeof quick>['variants'][number]) => {
    if (!quick || v.stock <= 0) return
    const line = addLine({ sku: v.sku, handle: product.handle, name: product.name, colourName: quick.colourName, size: v.size, sizeSystem, image: product.image, prices: v.prices })
    if (line) trackAddToCart(line, currency, priceIn(v.prices, currency).amount, 'quick_add')
    setPicking(false)
  }
  const onQuick = () => {
    if (!quick) return
    if (quick.variants.length === 1) addVariant(quick.variants[0])
    else setPicking(true)
  }
  const soldOut = !!quick && quick.variants.every((v) => v.stock <= 0)

  return (
    <article className="group relative flex w-full flex-col">
      <a
        href={href}
        className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        aria-label={t('commerce.viewProduct', { name: product.name })}
      >
        <div className={`relative w-full overflow-hidden bg-surface ${aspect === 'square' ? 'aspect-square' : 'aspect-4/5'}`}>
          {product.image ? (
            <>
              <Image
                src={product.image}
                alt={product.name}
                fill
                priority={priority}
                sizes={sizes ?? '(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw'}
                className="object-cover motion-safe:transition-transform motion-safe:duration-700 ease-kinetic motion-safe:group-hover:scale-[1.03]"
              />
              {product.hoverImage && (
                <Image
                  src={product.hoverImage}
                  alt=""
                  aria-hidden
                  fill
                  sizes={sizes ?? '(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw'}
                  className="object-cover opacity-0 motion-safe:transition-opacity motion-safe:duration-500 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-end p-md" aria-hidden>
              <span className="text-label uppercase tracking-label text-fg-muted">{product.name}</span>
            </div>
          )}
          {badge && (
            <span
              className={`absolute left-sm top-sm px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-label ${
                badge === 'archive' ? 'bg-canvas/90 text-fg-muted' : 'bg-canvas/90 text-fg'
              }`}
            >
              {t(`commerce.badge_${badge}` as MessageKey)}
            </span>
          )}
        </div>

        <div className="mt-sm flex flex-col gap-1 pr-10">
          <h3 className="text-body font-medium leading-snug text-fg text-pretty">{product.name}</h3>
          <Price price={product.price} locale={locale} size="sm" labels={{ was: t('commerce.was'), now: t('commerce.now') }} />
        </div>
      </a>

      {product.colours.length > 1 && (
        <ul className="mt-2 flex items-center gap-1.5" aria-label={t('commerce.colour')}>
          {product.colours.slice(0, MAX_SWATCHES).map((c) => (
            <li key={c.code} title={c.name} className="h-3 w-3 border border-fg/20" style={{ backgroundColor: c.hex }}>
              <span className="sr-only">{c.name}</span>
            </li>
          ))}
          {extraSwatches > 0 && <li className="text-xs text-fg-muted">+{extraSwatches}</li>}
        </ul>
      )}

      {quick && !soldOut && (
        <div
          ref={quickRef}
          className={`pointer-events-none absolute inset-x-0 top-0 ${aspect === 'square' ? 'aspect-square' : 'aspect-4/5'}`}
        >
          {picking ? (
            <div
              role="group"
              aria-label={t('commerce.selectSize')}
              className="pointer-events-auto absolute inset-x-xs bottom-xs flex flex-col gap-xs bg-canvas/95 p-xs shadow-[0_8px_24px_oklch(from_var(--ot-fg)_l_c_h/0.12)] motion-safe:animate-fade-in"
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-label font-semibold uppercase tracking-label text-fg">{t('commerce.selectSize')}{convention ? ` (${convention})` : ''}</span>
                <button type="button" onClick={() => { setPicking(false); triggerRef.current?.focus() }} aria-label={t('commerce.closeQuickAdd')} className="inline-flex h-8 w-8 items-center justify-center text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-brand">
                  <X size={16} aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {quick.variants.map((v, i) => (
                  <button
                    key={v.sku}
                    ref={i === 0 ? firstSizeRef : undefined}
                    type="button"
                    disabled={v.stock <= 0}
                    onClick={() => addVariant(v)}
                    aria-label={t('commerce.quickAddSize', { name: product.name, size: sizeLabel(v.size, sizeSystem, market) })}
                    className="h-9 min-w-11 flex-1 border border-fg/20 px-2 text-sm text-fg hover:border-fg focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-fg-muted/60 disabled:line-through"
                  >
                    {sizeLabel(v.size, sizeSystem, market)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              ref={triggerRef}
              type="button"
              onClick={onQuick}
              aria-label={t('commerce.quickAddProduct', { name: product.name })}
              className="pointer-events-auto absolute inset-x-xs bottom-xs flex h-10 items-center justify-center gap-1.5 bg-canvas/90 text-label font-semibold uppercase tracking-label text-fg opacity-0 motion-safe:transition-opacity duration-200 ease-quick hover:bg-canvas group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand [@media(hover:none)]:opacity-100"
            >
              <Plus size={14} aria-hidden />
              {t('commerce.quickAdd')}
            </button>
          )}
        </div>
      )}

      {enabled && (
        <button
          type="button"
          onClick={onHeart}
          aria-pressed={saved}
          aria-label={t(saved ? 'commerce.removeFromWishlist' : 'commerce.addToWishlist', { name: product.name })}
          className="absolute right-xs top-xs inline-flex h-11 w-11 items-center justify-center text-fg motion-safe:transition-transform duration-150 ease-quick hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand"
        >
          <Heart size={18} strokeWidth={1.75} aria-hidden className={saved ? 'fill-fg' : ''} />
        </button>
      )}
    </article>
  )
}
