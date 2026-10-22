'use client'

import Image from 'next/image'
import { Minus, Plus } from 'lucide-react'
import Price from '@/components/commerce/Price'
import { useCommerce } from '@/components/commerce/CommerceProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { localizedHref } from '@/lib/i18n/config'
import { priceIn } from '@/lib/commerce/card'
import { trackRemoveFromCart } from '@/lib/commerce/track'
import { sizeLabel } from '@/lib/commerce/sizes'
import type { CartLine } from '@/lib/commerce/types'

type Props = {
  line:      CartLine
  /** Compact = mini-bag drawer; roomy = bag page. */
  density?:  'compact' | 'roomy'
  /** Read-only (order confirmation / checkout summary): no stepper or remove. */
  readOnly?: boolean
}

/** One bag line — image, name, variant, quantity stepper, line total, remove. */
export default function BagLineItem({ line, density = 'compact', readOnly = false }: Props) {
  const { t, locale } = useTranslation()
  const { currency, market, setQuantity, removeLine } = useCommerce()
  const unit = priceIn(line.prices, currency)
  const lineTotal = { ...unit, amount: unit.amount * line.quantity, compareAt: unit.compareAt != null ? unit.compareAt * line.quantity : null }
  const roomy = density === 'roomy'
  const stepBtn =
    'inline-flex h-9 w-9 items-center justify-center text-fg-muted hover:text-fg disabled:opacity-30 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand'

  return (
    <li className={`flex gap-md ${roomy ? 'py-lg' : 'py-md'}`}>
      <a href={localizedHref(`/products/${line.handle}`, locale)} className={`relative flex-none overflow-hidden bg-surface ${roomy ? 'h-40 w-32' : 'h-24 w-20'}`}>
        {line.image && <Image src={line.image} alt={line.name} fill sizes={roomy ? '128px' : '80px'} className="object-cover" />}
      </a>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-sm">
          <div className="min-w-0">
            <a href={localizedHref(`/products/${line.handle}`, locale)} className={`${roomy ? 'text-title' : 'text-body'} block font-medium leading-snug text-fg hover:underline underline-offset-4`}>
              {line.name}
            </a>
            <p className="mt-1 text-sm text-fg-muted">
              {line.colourName} · {sizeLabel(line.size, line.sizeSystem, market)}
              {readOnly && <> · {t('commerce.quantity')} {line.quantity}</>}
            </p>
          </div>
          <Price price={lineTotal} locale={locale} size="sm" className="flex-none" labels={{ was: t('commerce.was'), now: t('commerce.now') }} />
        </div>

        {!readOnly && (
          <div className="mt-auto flex items-center justify-between pt-sm">
            <div className="inline-flex items-center border border-fg/15" role="group" aria-label={`${t('commerce.quantity')}: ${line.name}`}>
              <button type="button" className={stepBtn} onClick={() => setQuantity(line.sku, line.quantity - 1)} aria-label={t('commerce.decrease')}>
                <Minus size={14} aria-hidden />
              </button>
              <span className="w-8 text-center text-sm tabular-nums text-fg" aria-live="polite">{line.quantity}</span>
              <button type="button" className={stepBtn} onClick={() => setQuantity(line.sku, line.quantity + 1)} disabled={line.quantity >= 10} aria-label={t('commerce.increase')}>
                <Plus size={14} aria-hidden />
              </button>
            </div>
            <button
              type="button"
              onClick={() => { removeLine(line.sku); trackRemoveFromCart(line) }}
              className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {t('commerce.remove')}
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
