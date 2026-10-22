'use client'

import { Heart, ShoppingBag } from 'lucide-react'
import { useCommerce } from '@/components/commerce/CommerceProvider'
import PersonaSignIn from '@/components/commerce/PersonaSignIn'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { localizedHref } from '@/lib/i18n/config'

type Props = {
  /** Bag count read from the ot_bag_count cookie on the server — shown until
   *  the client store hydrates from localStorage, so the badge never flashes. */
  initialBagCount?: number
  /** Hide the wishlist link (mobile bar keeps just the bag). */
  showWishlist?: boolean
  /** Hide the demo sign-in (mobile bar keeps just the bag). */
  showAccount?:  boolean
}

const iconBtn =
  'relative flex items-center justify-center w-9 h-9 text-fg hover:text-brand ' +
  'transition-colors duration-150 ease-quick ' +
  'focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2'

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-brand px-1 text-[0.625rem] font-semibold tabular-nums leading-none text-fg-on-brand"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/**
 * Demo sign-in, wishlist and bag icons for the header utility cluster. Rendered by the header
 * components only when the site has mock commerce enabled; renders nothing
 * outside a CommerceProvider.
 */
export default function CommerceHeaderActions({ initialBagCount = 0, showWishlist = true, showAccount = showWishlist }: Props) {
  const { t, locale } = useTranslation()
  const { enabled, state, bagCount, openBag } = useCommerce()
  if (!enabled) return null

  const count = state.hydrated ? bagCount : initialBagCount
  const saved = state.wishlist.length

  return (
    <>
      {showAccount && <PersonaSignIn />}
      {showWishlist && (
        <a
          href={localizedHref('/wishlist', locale)}
          className={iconBtn}
          aria-label={t('commerce.wishlistCount', { count: saved })}
        >
          <Heart size={20} strokeWidth={1.75} aria-hidden />
          <CountBadge count={saved} />
        </a>
      )}
      <button type="button" onClick={openBag} className={iconBtn} aria-label={t('commerce.openBag', { count })} aria-haspopup="dialog">
        <ShoppingBag size={20} strokeWidth={1.75} aria-hidden />
        <CountBadge count={count} />
      </button>
    </>
  )
}
