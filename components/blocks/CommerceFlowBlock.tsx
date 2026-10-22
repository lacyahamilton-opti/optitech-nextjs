'use client'

import BagView, { type FlowCopy } from '@/components/commerce/flow/BagView'
import CheckoutView from '@/components/commerce/flow/CheckoutView'
import ConfirmationView from '@/components/commerce/flow/ConfirmationView'
import WishlistView from '@/components/commerce/flow/WishlistView'

export type CommerceFlowMode = 'bag' | 'checkout' | 'confirmation' | 'wishlist'

export type CommerceFlowBlockProps = FlowCopy & {
  mode:   CommerceFlowMode
  color?: 'canvas' | 'surface'
}

const VIEWS = { bag: BagView, checkout: CheckoutView, confirmation: ConfirmationView, wishlist: WishlistView } as const

/**
 * The mock storefront's transactional surfaces behind one block (see
 * OT_CommerceFlowBlock). Every view reads the shopper's own browser state from
 * CommerceProvider, so this renders client-side only.
 */
export default function CommerceFlowBlock({ mode, color = 'canvas', ...copy }: CommerceFlowBlockProps) {
  const View = VIEWS[mode] ?? BagView
  return (
    <section className={`${color === 'surface' ? 'bg-surface' : 'bg-canvas'} px-md py-lg lg:px-lg lg:py-xl`}>
      <div className="mx-auto max-w-[96rem]">
        <View {...copy} />
      </div>
    </section>
  )
}
