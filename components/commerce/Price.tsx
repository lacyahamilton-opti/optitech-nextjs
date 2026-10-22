import { formatMoney } from '@/lib/commerce/money'
import type { Money } from '@/lib/commerce/types'

type Props = {
  price:     Money
  locale?:   string
  /** Prefix "From" for products whose variants differ in price. */
  from?:     boolean
  size?:     'sm' | 'md' | 'lg'
  className?: string
  labels?:   { from?: string; was?: string; now?: string }
}

const SIZE = { sm: 'text-sm', md: 'text-body', lg: 'text-title' } as const

/**
 * Price display. A compare-at price (Archive revised prices) renders as a quiet
 * muted strikethrough beside the current price — no red, no percentage-off:
 * premium retail states the facts and lets the product carry the page
 * (DESIGN.md bans loud-discount-banner clichés). Screen readers get explicit
 * "Was / Now" wording rather than relying on the strikethrough.
 *
 * Server- and client-safe (no hooks). The FX price treatment (APP-019) is
 * resolved upstream (lib/commerce/pricing.ts) and arrives here as `price`,
 * with an optional `label` ("Reserve price") shown before the amount.
 */
export default function Price({ price, locale = 'en', from = false, size = 'md', className = '', labels = {} }: Props) {
  const current = formatMoney(price.amount, price.currency, locale)
  const hasCompare = price.compareAt != null && price.compareAt > price.amount

  return (
    <p className={`${SIZE[size]} tabular-nums text-fg ${className}`}>
      {price.label && (
        <span className="mr-2 align-middle text-[0.6875rem] font-semibold uppercase tracking-label text-fg-muted">{price.label}</span>
      )}
      {hasCompare ? (
        <>
          <span className="sr-only">{labels.was ?? 'Was'} </span>
          <s className="mr-2 text-fg-muted decoration-fg-muted/60">
            {formatMoney(price.compareAt!, price.currency, locale)}
          </s>
          <span className="sr-only">{labels.now ?? 'Now'} </span>
          <span className="font-semibold">{current}</span>
        </>
      ) : (
        <>
          {from && <span className="mr-1 text-fg-muted">{labels.from ?? 'From'}</span>}
          <span>{current}</span>
        </>
      )}
    </p>
  )
}
