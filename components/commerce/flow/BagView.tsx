'use client'

import { ShoppingBag } from 'lucide-react'
import Button from '@/components/ui/Button'
import BagLineItem from '@/components/commerce/BagLineItem'
import FreeShippingMeter from '@/components/commerce/FreeShippingMeter'
import OrderSummary, { type SummaryStyle } from '@/components/commerce/flow/OrderSummary'
import { useCommerce } from '@/components/commerce/CommerceProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { localizedHref } from '@/lib/i18n/config'
import { FREE_SHIPPING_THRESHOLD, SHIPPING } from '@/lib/commerce/money'
import { trackBeginCheckout } from '@/lib/commerce/track'

export type FlowCopy = {
  heading?:       string
  emptyMessage?:  string
  continueLabel?: string
  continueUrl?:   string
  assurance?:     string
  summaryStyle?:  SummaryStyle
}

export function EmptyState({ icon, message, hint, continueLabel, continueUrl }: { icon: React.ReactNode; message: string; hint?: string; continueLabel: string; continueUrl: string }) {
  return (
    <div className="flex flex-col items-center gap-sm py-2xl text-center">
      <span className="text-fg-muted" aria-hidden>{icon}</span>
      <p className="text-title font-semibold text-fg">{message}</p>
      {hint && <p className="max-w-md text-body text-fg-muted">{hint}</p>}
      <Button variant="ghost" size="sm" href={continueUrl} className="mt-sm">{continueLabel}</Button>
    </div>
  )
}

/** The full bag page: editable lines on the left, order summary on the right. */
export default function BagView({ heading, emptyMessage, continueLabel, continueUrl, assurance, summaryStyle }: FlowCopy) {
  const { t, locale } = useTranslation()
  const { state, bagCount, subtotal, currency } = useCommerce()
  const home = continueUrl || localizedHref('/', locale)
  const continueText = continueLabel || t('commerce.continueShopping')

  if (!state.hydrated) return <div className="min-h-[40vh]" aria-busy="true" />

  return (
    <div>
      <h1 className="mb-lg text-headline font-semibold leading-headline tracking-headline text-fg">
        {heading || t('commerce.bag')} <span className="text-fg-muted">({bagCount})</span>
      </h1>
      {state.bag.length === 0 ? (
        <EmptyState icon={<ShoppingBag size={32} strokeWidth={1.25} />} message={emptyMessage || t('commerce.bagEmpty')} hint={t('commerce.bagEmptyHint')} continueLabel={continueText} continueUrl={home} />
      ) : (
        <div className="grid grid-cols-1 gap-xl lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div>
            <div className="border-b border-fg/10 pb-md"><FreeShippingMeter /></div>
            <ul className="divide-y divide-fg/10">
              {state.bag.map((line) => <BagLineItem key={line.sku} line={line} density="roomy" />)}
            </ul>
          </div>
          <div className="lg:sticky lg:top-[calc(var(--ot-site-header-h,5rem)+2rem)] lg:self-start">
            <OrderSummary
              currency={currency}
              subtotal={subtotal}
              shipping={subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING.standard.amount}
              itemCount={bagCount}
              style={summaryStyle}
              assurance={assurance}
            >
              <div className="flex flex-col gap-sm">
                <Button
                  variant={summaryStyle === 'brand' ? 'accent' : 'brand'}
                  href={localizedHref('/checkout', locale)}
                  className="w-full"
                  onClick={() => trackBeginCheckout(bagCount, currency, subtotal)}
                >
                  {t('commerce.checkout')}
                </Button>
                <a href={home} className="self-center text-sm underline underline-offset-4 opacity-80 hover:opacity-100">{continueText}</a>
              </div>
            </OrderSummary>
          </div>
        </div>
      )}
    </div>
  )
}
