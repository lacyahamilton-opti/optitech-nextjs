'use client'

import { useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Lock, ShoppingBag } from 'lucide-react'
import Button from '@/components/ui/Button'
import BagLineItem from '@/components/commerce/BagLineItem'
import OrderSummary from '@/components/commerce/flow/OrderSummary'
import { EmptyState, type FlowCopy } from '@/components/commerce/flow/BagView'
import { useCommerce, bagSubtotal } from '@/components/commerce/CommerceProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { localizedHref } from '@/lib/i18n/config'
import { formatMoney, FREE_SHIPPING_THRESHOLD, SHIPPING } from '@/lib/commerce/money'
import { trackPaymentInfo, trackPurchase, trackShippingInfo } from '@/lib/commerce/track'
import { readAcquisition } from '@/lib/acquisition'
import { currentPersona, DEFAULT_PERSONA_ID, getPersona, TEST_CARD as DEMO_CARD, type DemoPersona } from '@/lib/commerce/personas'
import { getDemoId } from '@/lib/commerce/identify'
import type { Order, OrderAddress } from '@/lib/commerce/types'

type Delivery = Order['delivery']
type Errors = Partial<Record<string, string>>

const TEST_CARD = DEMO_CARD.number.replace(/\s/g, '')
const COUNTRIES = ['United States', 'United Kingdom', 'France', 'Germany', 'Spain', 'Canada']

function newOrderId(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return 'AI-' + Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').toUpperCase().slice(0, 7)
}

const inputCls =
  'h-12 w-full rounded-input border border-fg/20 bg-canvas px-sm text-body text-fg placeholder:text-fg-muted/60 ' +
  'focus:border-brand focus:outline-none focus:[box-shadow:0_0_0_2px_var(--ot-bloom-brand-ring)] aria-[invalid=true]:border-fg'

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-fg">{label}</label>
      {children}
      {error && <p id={`${id}-err`} className="text-sm text-fg" role="alert">{error}</p>}
    </div>
  )
}

/**
 * Three-step demo checkout — details, delivery, payment — with inline
 * validation. Payment accepts ONLY the published test card. Nothing typed here
 * is sent anywhere: the order (for the confirmation page) goes to
 * sessionStorage, and no card data is kept at all. A signed-in demo persona
 * pre-fills every field; guests get a one-click "Use demo details".
 */
/**
 * Retail analytics (BigQuery) — fire-and-forget. Only what was bought is sent;
 * the server re-prices it and never receives name, email or address. The
 * customer is the persona (or generated shopper's tier and city) plus this
 * browser's demo id, matching the per-demo ODP profile.
 */
function recordOrderForAnalytics(order: Order, persona: DemoPersona | null) {
  const device = window.matchMedia('(max-width: 767px)').matches ? 'mobile' : window.matchMedia('(max-width: 1023px)').matches ? 'tablet' : 'desktop'
  fetch('/api/bq/retail-order', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: order.id, currency: order.currency, delivery: order.delivery, device,
      personaId: persona?.id ?? null, demoId: getDemoId(),
      ...(persona ? { segment: persona.segment, city: persona.address.city } : {}),
      lines: order.lines.map((l) => ({ handle: l.handle, sku: l.sku, quantity: l.quantity })),
    }),
  }).catch(() => { /* analytics only */ })
}

export default function CheckoutView({ heading, emptyMessage, continueLabel, continueUrl, assurance, summaryStyle }: FlowCopy) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const uid = useId()
  const { state, bagCount, subtotal, currency, completeOrder, signOut } = useCommerce()
  const persona = currentPersona(state)

  const [step, setStep] = useState(1)
  const [placing, setPlacing] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [address, setAddress] = useState<OrderAddress>({ firstName: '', lastName: '', email: '', line1: '', city: '', postcode: '', country: COUNTRIES[0] })
  const [delivery, setDelivery] = useState<Delivery>('standard')
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', name: '' })

  const fillFrom = (p: DemoPersona | null) => {
    if (!p) return
    setAddress(p.address)
    setCard({ ...DEMO_CARD, name: `${p.address.firstName} ${p.address.lastName}` })
    setErrors({})
  }
  // Pre-fill from the signed-in persona once storage has hydrated.
  const signedIn = state.hydrated ? persona?.address.email ?? null : null
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { if (signedIn) fillFrom(persona) }, [signedIn])

  const home = continueUrl || localizedHref('/', locale)
  const shipping = delivery === 'standard' && subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING[delivery].amount
  const req = (field: string) => t('commerce.required', { field })

  if (!state.hydrated) return <div className="min-h-[40vh]" aria-busy="true" />
  if (state.bag.length === 0) {
    return <EmptyState icon={<ShoppingBag size={32} strokeWidth={1.25} />} message={emptyMessage || t('commerce.bagEmpty')} hint={t('commerce.bagEmptyHint')} continueLabel={continueLabel || t('commerce.continueShopping')} continueUrl={home} />
  }

  const validate = (s: number): Errors => {
    const e: Errors = {}
    if (s === 1) {
      if (!address.firstName.trim()) e.firstName = req(t('commerce.firstName'))
      if (!address.lastName.trim()) e.lastName = req(t('commerce.lastName'))
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address.email.trim())) e.email = t('commerce.invalidEmail')
    }
    if (s === 2 && delivery !== 'collect') {
      if (!address.line1.trim()) e.line1 = req(t('commerce.address'))
      if (!address.city.trim()) e.city = req(t('commerce.city'))
      if (!address.postcode.trim()) e.postcode = req(t('commerce.postcode'))
    }
    if (s === 3) {
      if (card.number.replace(/\s/g, '') !== TEST_CARD) e.number = t('commerce.invalidCard')
      const m = card.expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/)
      const now = new Date()
      const valid = m && Number(m[1]) >= 1 && Number(m[1]) <= 12 &&
        new Date(2000 + Number(m[2]), Number(m[1])) > now
      if (!valid) e.expiry = t('commerce.invalidExpiry')
      if (!/^\d{3,4}$/.test(card.cvc)) e.cvc = t('commerce.invalidCvc')
      if (!card.name.trim()) e.name = req(t('commerce.nameOnCard'))
    }
    return e
  }

  const next = () => {
    const e = validate(step)
    setErrors(e)
    if (Object.keys(e).length) return
    if (step === 2) trackShippingInfo(delivery, currency, bagSubtotal(state.bag, currency))
    setStep((s) => Math.min(3, s + 1))
  }

  const placeOrder = () => {
    const e = validate(3)
    setErrors(e)
    if (Object.keys(e).length) return
    setPlacing(true)
    const lines = state.bag
    const acq = readAcquisition()
    const sub = bagSubtotal(lines, currency)
    const order: Order = {
      id: newOrderId(),
      placedAt: new Date().toISOString(),
      lines,
      currency,
      subtotal: sub,
      shipping,
      total: sub + shipping,
      delivery,
      address: { ...address, email: address.email.trim() },
      ...(acq ? { acquisition: { source: acq.source, medium: acq.medium, campaign: acq.campaign } } : {}),
    }
    completeOrder(order)
    trackPaymentInfo(currency, order.total)
    trackPurchase(order, acq ? { utm_source: acq.source, utm_medium: acq.medium, utm_campaign: acq.campaign } : {})
    recordOrderForAnalytics(order, persona)
    router.push(localizedHref('/checkout/confirmation', locale))
  }

  const steps = [t('commerce.stepDetails'), t('commerce.stepDelivery'), t('commerce.stepPayment')]
  const f = (k: keyof OrderAddress) => ({
    id: `${uid}-${k}`,
    value: address[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddress((a) => ({ ...a, [k]: e.target.value })),
    'aria-invalid': !!errors[k] || undefined,
    'aria-describedby': errors[k] ? `${uid}-${k}-err` : undefined,
    className: inputCls,
  })
  const c = (k: keyof typeof card) => ({
    id: `${uid}-${k}`,
    value: card[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCard((x) => ({ ...x, [k]: e.target.value })),
    'aria-invalid': !!errors[k] || undefined,
    'aria-describedby': errors[k] ? `${uid}-${k}-err` : undefined,
    className: inputCls,
  })

  return (
    <div>
      <h1 className="mb-md text-headline font-semibold leading-headline tracking-headline text-fg">{heading || t('commerce.checkoutTitle')}</h1>

      {/* Progress */}
      <ol className="mb-lg grid grid-cols-3 gap-xs" aria-label={t('commerce.stepOf', { step, total: 3 })}>
        {steps.map((label, i) => {
          const n = i + 1
          const done = n < step
          return (
            <li key={label} className="flex flex-col gap-xs" aria-current={n === step ? 'step' : undefined}>
              <span className={`h-0.5 w-full ${n <= step ? 'bg-fg' : 'bg-fg/15'}`} aria-hidden />
              <span className={`flex items-center gap-1 text-label uppercase tracking-label font-semibold ${n <= step ? 'text-fg' : 'text-fg-muted'}`}>
                {done && <Check size={12} aria-hidden />}{n}. {label}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-[minmax(0,1fr)_24rem]">
        <form
          noValidate
          onSubmit={(e) => { e.preventDefault(); if (step < 3) next(); else placeOrder() }}
          className="flex flex-col gap-md"
        >
          {step === 1 && (
            <p className="flex flex-wrap items-center gap-x-sm gap-y-1 bg-surface px-md py-sm text-sm text-fg">
              {persona ? (
                <>
                  <span>{t('commerce.signedInAs', { name: `${persona.address.firstName} ${persona.address.lastName}` })}</span>
                  <button type="button" onClick={() => { signOut(); setAddress({ firstName: '', lastName: '', email: '', line1: '', city: '', postcode: '', country: COUNTRIES[0] }); setCard({ number: '', expiry: '', cvc: '', name: '' }) }} className="underline underline-offset-4 hover:text-brand">
                    {t('commerce.notYou')}
                  </button>
                </>
              ) : (
                <>
                  <span>{t('commerce.guestCheckout')}</span>
                  <button type="button" onClick={() => fillFrom(getPersona(DEFAULT_PERSONA_ID))} className="underline underline-offset-4 hover:text-brand">
                    {t('commerce.useDemoDetails')}
                  </button>
                </>
              )}
            </p>
          )}

          {step === 1 && (
            <fieldset className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <legend className="sr-only">{steps[0]}</legend>
              <Field id={`${uid}-firstName`} label={t('commerce.firstName')} error={errors.firstName}><input {...f('firstName')} autoComplete="given-name" /></Field>
              <Field id={`${uid}-lastName`} label={t('commerce.lastName')} error={errors.lastName}><input {...f('lastName')} autoComplete="family-name" /></Field>
              <div className="sm:col-span-2">
                <Field id={`${uid}-email`} label={t('commerce.email')} error={errors.email}><input {...f('email')} type="email" autoComplete="email" /></Field>
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <>
              <fieldset className="flex flex-col gap-sm">
                <legend className="mb-sm text-label uppercase tracking-label font-semibold text-fg">{t('commerce.deliveryMethod')}</legend>
                {(Object.keys(SHIPPING) as Delivery[]).map((d) => {
                  const cost = d === 'standard' && subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING[d].amount
                  return (
                    <label key={d} className={`flex cursor-pointer items-center justify-between border px-md py-sm ${delivery === d ? 'border-fg' : 'border-fg/15 hover:border-fg/40'}`}>
                      <span className="flex items-center gap-sm">
                        <input type="radio" name={`${uid}-delivery`} value={d} checked={delivery === d} onChange={() => setDelivery(d)} className="accent-[var(--ot-brand)]" />
                        <span className="text-body text-fg">{SHIPPING[d].label}</span>
                      </span>
                      <span className="text-body tabular-nums text-fg">{cost === 0 ? t('commerce.shippingFree') : formatMoney(cost, currency, locale)}</span>
                    </label>
                  )
                })}
              </fieldset>
              {delivery !== 'collect' && (
                <fieldset className="grid grid-cols-1 gap-md sm:grid-cols-2">
                  <legend className="sr-only">{t('commerce.address')}</legend>
                  <div className="sm:col-span-2">
                    <Field id={`${uid}-line1`} label={t('commerce.address')} error={errors.line1}><input {...f('line1')} autoComplete="address-line1" /></Field>
                  </div>
                  <Field id={`${uid}-city`} label={t('commerce.city')} error={errors.city}><input {...f('city')} autoComplete="address-level2" /></Field>
                  <Field id={`${uid}-postcode`} label={t('commerce.postcode')} error={errors.postcode}><input {...f('postcode')} autoComplete="postal-code" /></Field>
                  <div className="sm:col-span-2">
                    <Field id={`${uid}-country`} label={t('commerce.country')}>
                      <select {...f('country')} autoComplete="country-name">
                        {COUNTRIES.map((ct) => <option key={ct}>{ct}</option>)}
                      </select>
                    </Field>
                  </div>
                </fieldset>
              )}
            </>
          )}

          {step === 3 && (
            <fieldset className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <legend className="sr-only">{steps[2]}</legend>
              <p className="flex items-start gap-sm bg-surface p-md text-sm text-fg sm:col-span-2">
                <Lock size={16} aria-hidden className="mt-0.5 flex-none" />
                {t('commerce.demoPayment')}
              </p>
              <div className="sm:col-span-2">
                <Field id={`${uid}-number`} label={t('commerce.cardNumber')} error={errors.number}>
                  <input {...c('number')} inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" />
                </Field>
              </div>
              <Field id={`${uid}-expiry`} label={t('commerce.expiry')} error={errors.expiry}><input {...c('expiry')} inputMode="numeric" autoComplete="off" placeholder="12/29" /></Field>
              <Field id={`${uid}-cvc`} label={t('commerce.cvc')} error={errors.cvc}><input {...c('cvc')} inputMode="numeric" autoComplete="off" placeholder="123" /></Field>
              <div className="sm:col-span-2">
                <Field id={`${uid}-name`} label={t('commerce.nameOnCard')} error={errors.name}><input {...c('name')} autoComplete="off" /></Field>
              </div>
            </fieldset>
          )}

          <div className="mt-sm flex flex-wrap items-center gap-md">
            {step > 1 && (
              <button type="button" onClick={() => { setErrors({}); setStep((s) => s - 1) }} className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg">
                {t('commerce.back')}
              </button>
            )}
            <Button type="submit" variant="brand" className="ml-auto min-w-56" disabled={placing}>
              {step < 3
                ? t('commerce.continueTo', { step: steps[step] })
                : placing ? t('commerce.placingOrder') : t('commerce.placeOrder', { amount: formatMoney(subtotal + shipping, currency, locale) })}
            </Button>
          </div>
        </form>

        <div className="lg:sticky lg:top-[calc(var(--ot-site-header-h,5rem)+2rem)] lg:self-start">
          <OrderSummary currency={currency} subtotal={subtotal} shipping={step >= 2 ? shipping : null} itemCount={bagCount} style={summaryStyle} assurance={assurance}>
            <ul className="max-h-80 divide-y divide-fg/10 overflow-y-auto">
              {state.bag.map((line) => <BagLineItem key={line.sku} line={line} readOnly />)}
            </ul>
          </OrderSummary>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{t('commerce.stepOf', { step, total: 3 })}: {steps[step - 1]}</span>
    </div>
  )
}
