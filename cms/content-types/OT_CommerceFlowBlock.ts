import { contentType } from '@optimizely/cms-sdk'

// ─── OT_CommerceFlowBlock ─────────────────────────────────────────────────────
// The mock storefront's transactional surfaces, as ONE block with a mode:
//   bag          — full bag page (lines, quantities, order summary)
//   checkout     — 3-step demo checkout (details → delivery → test-card payment)
//   confirmation — the order just placed
//   wishlist     — saved products
// Editors place it on /bag, /checkout, /checkout/confirmation and /wishlist and
// compose around it (next-best recs, delivery promises, post-purchase cards).
//
// There is no commerce backend: state lives in the shopper's browser
// (components/commerce/CommerceProvider). No payment is taken and no card data
// is stored beyond the last four digits of the published test card.

export const OT_CommerceFlowBlock = contentType({
  key:         'OT_CommerceFlowBlock',
  displayName: 'Commerce Flow',
  description: 'Bag, checkout, order confirmation or wishlist for the mock storefront. Requires mock commerce on this site.',
  baseType:    '_component',
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'],
  properties: {
    mode: {
      type: 'string', format: 'selectOne', displayName: 'Mode',
      description: 'Which part of the shopping flow this block renders.',
      enum: [
        { value: 'bag',          displayName: 'Bag' },
        { value: 'checkout',     displayName: 'Checkout' },
        { value: 'confirmation', displayName: 'Order confirmation' },
        { value: 'wishlist',     displayName: 'Wishlist' },
      ],
      group: 'OT_Content', sortOrder: 5,
    },
    heading: {
      type: 'string', isLocalized: true, maxLength: 80, displayName: 'Heading',
      description: 'Defaults per mode ("Your bag", "Checkout", "Wishlist"). Confirmation greets the shopper by name.',
      group: 'OT_Content', sortOrder: 10,
    },
    emptyMessage: {
      type: 'string', isLocalized: true, maxLength: 160, displayName: 'Empty Message',
      description: 'Shown when the bag or wishlist is empty.',
      group: 'OT_Content', sortOrder: 20,
    },
    continueLabel: {
      type: 'string', isLocalized: true, maxLength: 40, displayName: 'Continue Shopping Label',
      group: 'OT_Content', sortOrder: 30,
    },
    continueUrl: {
      type: 'url', displayName: 'Continue Shopping URL',
      description: 'Where "Continue shopping" goes. Defaults to the home page.',
      group: 'OT_Content', sortOrder: 40,
    },
    assurance: {
      type: 'string', isLocalized: true, maxLength: 240, displayName: 'Assurance Line',
      description: 'Short reassurance under the order summary (returns, repairs, secure checkout).',
      group: 'OT_Content', sortOrder: 50,
    },
  },
})
