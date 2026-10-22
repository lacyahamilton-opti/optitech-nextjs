'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, ShoppingBag, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import BagLineItem from '@/components/commerce/BagLineItem'
import FreeShippingMeter from '@/components/commerce/FreeShippingMeter'
import { useCommerce } from '@/components/commerce/CommerceProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { localizedHref } from '@/lib/i18n/config'
import { formatMoney } from '@/lib/commerce/money'

/**
 * Right-hand bag drawer. Opens from the header bag icon or automatically after
 * "Add to bag" (with an added-item confirmation). Radix Dialog supplies the
 * focus trap, Esc-to-close, scroll lock and aria-modal; motion is transform +
 * opacity only and collapses under prefers-reduced-motion. Any navigation
 * (View bag, Checkout, a product link) closes it.
 */
export default function MiniBag() {
  const { t, locale } = useTranslation()
  const { state, bagOpen, closeBag, bagCount, subtotal, currency, lastAdded } = useCommerce()
  const lines = state.bag

  const pathname = usePathname()
  const lastPath = useRef(pathname)
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    closeBag()
  }, [pathname, closeBag])

  return (
    <Dialog.Root open={bagOpen} onOpenChange={(open) => { if (!open) closeBag() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-canvas/60 backdrop-blur-sm motion-safe:data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className="minibag-panel fixed inset-y-0 right-0 z-[201] flex w-full max-w-[26rem] flex-col bg-canvas shadow-[0_0_64px_oklch(from_var(--ot-fg)_l_c_h/0.16)] focus:outline-none"
          aria-describedby={undefined}
        >
          <header className="flex items-center justify-between border-b border-fg/10 px-lg py-md">
            <Dialog.Title className="text-label uppercase tracking-label font-semibold text-fg">
              {t('commerce.bag')} <span className="text-fg-muted">({bagCount})</span>
            </Dialog.Title>
            <Dialog.Close
              className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={t('commerce.closeBag')}
            >
              <X size={20} aria-hidden />
            </Dialog.Close>
          </header>

          {lastAdded && lines.some((l) => l.sku === lastAdded.sku) && (
            <p className="flex items-center gap-sm bg-surface px-lg py-sm text-sm text-fg" role="status">
              <Check size={16} aria-hidden className="text-brand" />
              {t('commerce.addedToBag')}
            </p>
          )}

          {lines.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-sm px-lg text-center">
              <ShoppingBag size={28} strokeWidth={1.25} aria-hidden className="text-fg-muted" />
              <p className="text-title font-semibold text-fg">{t('commerce.bagEmpty')}</p>
              <p className="text-body text-fg-muted">{t('commerce.bagEmptyHint')}</p>
              <Button variant="ghost" size="sm" className="mt-sm" onClick={closeBag}>{t('commerce.continueShopping')}</Button>
            </div>
          ) : (
            <>
              <div className="border-b border-fg/10 px-lg py-md">
                <FreeShippingMeter />
              </div>
              <ul className="flex-1 divide-y divide-fg/10 overflow-y-auto px-lg">
                {lines.map((line) => <BagLineItem key={line.sku} line={line} />)}
              </ul>
              <footer className="flex flex-col gap-md border-t border-fg/10 px-lg py-lg">
                <div className="flex items-baseline justify-between">
                  <span className="text-label uppercase tracking-label font-semibold text-fg">{t('commerce.subtotal')}</span>
                  <span className="text-title tabular-nums text-fg">{formatMoney(subtotal, currency, locale)}</span>
                </div>
                <p className="-mt-sm text-sm text-fg-muted">{t('commerce.shippingAtCheckout')}</p>
                <div className="grid grid-cols-2 gap-sm">
                  <Button variant="ghost" size="sm" href={localizedHref('/bag', locale)}>{t('commerce.viewBag')}</Button>
                  <Button variant="brand" size="sm" href={localizedHref('/checkout', locale)}>{t('commerce.checkout')}</Button>
                </div>
              </footer>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
