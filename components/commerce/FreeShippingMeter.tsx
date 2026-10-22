'use client'

import { useCommerce } from '@/components/commerce/CommerceProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { formatMoney, FREE_SHIPPING_THRESHOLD } from '@/lib/commerce/money'

/**
 * Progress toward complimentary delivery. The bar fills with a transform
 * (scaleX), never width, so it animates without layout work (DESIGN.md §11).
 */
export default function FreeShippingMeter({ threshold = FREE_SHIPPING_THRESHOLD }: { threshold?: number }) {
  const { t, locale } = useTranslation()
  const { subtotal, currency } = useCommerce()
  const remaining = Math.max(0, threshold - subtotal)
  const progress = Math.min(1, subtotal / threshold)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-fg" aria-live="polite">
        {remaining === 0
          ? t('commerce.freeShippingUnlocked')
          : t('commerce.freeShippingProgress', { amount: formatMoney(remaining, currency, locale) })}
      </p>
      <div className="h-0.5 w-full overflow-hidden bg-fg/10" aria-hidden>
        <div
          className="h-full w-full origin-left bg-brand motion-safe:transition-transform motion-safe:duration-500 ease-kinetic"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  )
}
