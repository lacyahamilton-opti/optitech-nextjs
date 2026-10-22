'use client'

import { useTranslation } from '@/lib/i18n/useTranslation'
import { formatMoney } from '@/lib/commerce/money'
import type { CurrencyCode } from '@/lib/commerce/types'

export type SummaryStyle = 'surface' | 'brand' | 'ruled'

type Props = {
  currency:  CurrencyCode
  subtotal:  number
  /** null = not yet known ("Calculated at checkout"). */
  shipping:  number | null
  itemCount: number
  style?:    SummaryStyle
  children?: React.ReactNode
  assurance?: string
}

const PANEL: Record<SummaryStyle, string> = {
  surface: 'bg-surface p-lg',
  brand:   'bg-brand-fill p-lg text-fg-on-brand',
  ruled:   'border-y border-fg/15 py-lg',
}

/** Subtotal / delivery / total panel shared by the bag and checkout. */
export default function OrderSummary({ currency, subtotal, shipping, itemCount, style = 'surface', children, assurance }: Props) {
  const { t, locale } = useTranslation()
  const onBrand = style === 'brand'
  const muted = onBrand ? 'text-fg-on-brand/75' : 'text-fg-muted'
  const strong = onBrand ? 'text-fg-on-brand' : 'text-fg'

  return (
    <aside className={`flex flex-col gap-md ${PANEL[style]}`} {...(onBrand ? { 'data-theme': 'dark' } : {})} aria-label={t('commerce.orderSummary')}>
      <h2 className={`text-label uppercase tracking-label font-semibold ${strong}`}>{t('commerce.orderSummary')}</h2>
      {children}
      <dl className="flex flex-col gap-sm text-body">
        <div className="flex justify-between">
          <dt className={muted}>{t('commerce.subtotal')} · {itemCount === 1 ? t('commerce.itemCountOne') : t('commerce.itemCount', { count: itemCount })}</dt>
          <dd className={`tabular-nums ${strong}`}>{formatMoney(subtotal, currency, locale)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className={muted}>{t('commerce.shipping')}</dt>
          <dd className={`tabular-nums ${strong}`}>
            {shipping == null ? t('commerce.shippingAtCheckout') : shipping === 0 ? t('commerce.shippingFree') : formatMoney(shipping, currency, locale)}
          </dd>
        </div>
        <div className={`mt-xs flex justify-between border-t pt-md ${onBrand ? 'border-fg-on-brand/25' : 'border-fg/15'}`}>
          <dt className={`text-label uppercase tracking-label font-semibold ${strong}`}>{t('commerce.total')}</dt>
          <dd className={`text-title font-semibold tabular-nums ${strong}`}>{formatMoney(subtotal + (shipping ?? 0), currency, locale)}</dd>
        </div>
      </dl>
      {assurance && <p className={`text-sm ${muted}`}>{assurance}</p>}
    </aside>
  )
}
