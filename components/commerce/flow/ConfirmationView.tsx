'use client'

import { CircleCheck, Receipt } from 'lucide-react'
import BagLineItem from '@/components/commerce/BagLineItem'
import OrderSummary from '@/components/commerce/flow/OrderSummary'
import { EmptyState, type FlowCopy } from '@/components/commerce/flow/BagView'
import { useCommerce } from '@/components/commerce/CommerceProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { localizedHref } from '@/lib/i18n/config'
import { SHIPPING } from '@/lib/commerce/money'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' }

/** The order just placed — read back from the browser, never from a server. */
export default function ConfirmationView({ heading, continueLabel, continueUrl, assurance, summaryStyle }: FlowCopy) {
  const { t, locale } = useTranslation()
  const { state } = useCommerce()
  const order = state.lastOrder
  const home = continueUrl || localizedHref('/', locale)

  if (!state.hydrated) return <div className="min-h-[40vh]" aria-busy="true" />
  if (!order) {
    return <EmptyState icon={<Receipt size={32} strokeWidth={1.25} />} message={t('commerce.noOrder')} continueLabel={continueLabel || t('commerce.continueShopping')} continueUrl={home} />
  }

  const itemCount = order.lines.reduce((n, l) => n + l.quantity, 0)
  const placed = new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? 'en-US', { dateStyle: 'long' }).format(new Date(order.placedAt))

  return (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-lg">
        <div className="flex flex-col gap-sm">
          <CircleCheck size={32} strokeWidth={1.25} aria-hidden className="text-fg" />
          <h1 className="text-headline font-semibold leading-headline tracking-headline text-fg text-balance">
            {heading || t('commerce.confirmationTitle', { name: order.address.firstName })}
          </h1>
          <p className="text-body leading-body text-fg-muted text-pretty">
            {t('commerce.confirmationBody', { id: order.id, email: order.address.email })}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-md border-y border-fg/10 py-md sm:grid-cols-4">
          <div><dt className="text-label uppercase tracking-label text-fg-muted">{t('commerce.orderNumber')}</dt><dd className="mt-1 font-mono text-sm text-fg">{order.id}</dd></div>
          <div><dt className="text-label uppercase tracking-label text-fg-muted">{t('commerce.placedOn')}</dt><dd className="mt-1 text-sm text-fg">{placed}</dd></div>
          <div><dt className="text-label uppercase tracking-label text-fg-muted">{t('commerce.deliveryMethod')}</dt><dd className="mt-1 text-sm text-fg">{SHIPPING[order.delivery].label}</dd></div>
          <div><dt className="text-label uppercase tracking-label text-fg-muted">{t('commerce.stepPayment')}</dt><dd className="mt-1 text-sm text-fg">{t('commerce.paidWith')}</dd></div>
        </dl>

        <ul className="divide-y divide-fg/10">
          {order.lines.map((line) => <BagLineItem key={line.sku} line={line} readOnly density="roomy" />)}
        </ul>
      </div>

      <div className="lg:sticky lg:top-[calc(var(--ot-site-header-h,5rem)+2rem)] lg:self-start">
        <OrderSummary currency={order.currency} subtotal={order.subtotal} shipping={order.shipping} itemCount={itemCount} style={summaryStyle} assurance={assurance}>
          <a href={home} className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100">
            {continueLabel || t('commerce.continueShopping')}
          </a>
        </OrderSummary>
      </div>
    </div>
  )
}
