import { contentType } from '@optimizely/cms-sdk'

// ─── OT_ProductRecommendationsBlock ──────────────────────────────────────────
// Live product recommendations from Optimizely Product Recommendations
// (Peerius). The engine script is configured once per domain on the
// ThemeManager (Integrations → Product Recommendations Script URL). At runtime
// the Peerius engine calls `smartRecs`, which dispatches a `peerius:recs` window
// event; the client widget renders the returned cards. No local catalog — when
// the engine returns nothing, the widget shows an empty state.
//
// heading / subheading — optional section copy above the grid.
// widgetPosition       — Peerius widget position key (e.g. "homePage_1"); blank
//                        uses the first widget the engine returns.
// initialCount         — how many cards to show before "Show all".
// showAllLabel         — label for the expand control.
//
// source = catalog (retail sites with mock commerce): recommendations come from
// the Graph product catalog instead of Peerius, using a merchandising strategy
// (lib/commerce/recommend.ts). Blank/peerius keeps the original live behaviour.

export const OT_ProductRecommendationsBlock = contentType({
  key:         'OT_ProductRecommendationsBlock',
  displayName: 'Product Recommendations',
  description: 'Product recommendations — live from Optimizely Product Recommendations (Peerius), or from the Graph product catalog with a merchandising strategy.',
  baseType:    '_component',
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'],
  properties: {
    heading: {
      type:        'string',
      isLocalized: true,
      maxLength:   120,
      displayName: 'Heading',
      description: 'Optional heading displayed above the recommendations grid.',
      group:       'OT_Content',
      sortOrder:   10,
      indexingType: 'searchable',
    },
    subheading: {
      type:        'string',
      isLocalized: true,
      maxLength:   200,
      displayName: 'Subheading',
      description: 'Optional supporting line below the heading.',
      group:       'OT_Content',
      sortOrder:   20,
      indexingType: 'searchable',
    },
    widgetPosition: {
      type:        'string',
      maxLength:   64,
      displayName: 'Widget Position',
      description: 'Peerius widget position key (e.g. homePage_1). Leave blank to use the first widget the engine returns.',
      group:       'OT_Content',
      sortOrder:   30,
    },
    initialCount: {
      type:        'string',
      format:      'selectOne',
      displayName: 'Initial Count',
      description: 'How many recommendations to show before the "Show all" control.',
      group:       'OT_Content',
      sortOrder:   40,
      enum: [
        { value: '3', displayName: '3' },
        { value: '4', displayName: '4' },
        { value: '6', displayName: '6' },
      ],
    },
    source: {
      type:        'string',
      format:      'selectOne',
      displayName: 'Source',
      description: 'Where recommendations come from. Catalog requires mock commerce on this site (ThemeManager → Integrations).',
      group:       'OT_Content',
      sortOrder:   25,
      enum: [
        { value: 'peerius', displayName: 'Optimizely Product Recommendations (live, default)' },
        { value: 'catalog', displayName: 'Product catalog (Graph)' },
      ],
    },
    strategy: {
      type:        'string',
      format:      'selectOne',
      displayName: 'Catalog Strategy',
      description: 'Catalog source only. Complete the look uses the product on a product page; Recently viewed and Pairs with your bag use the shopper\'s own session.',
      group:       'OT_Content',
      sortOrder:   26,
      enum: [
        { value: 'trending',        displayName: 'Trending' },
        { value: 'category',        displayName: 'From a category' },
        { value: 'manual',          displayName: 'Hand-picked products' },
        { value: 'completeTheLook', displayName: 'Complete the look (product pages)' },
        { value: 'recentlyViewed',  displayName: 'Recently viewed' },
        { value: 'nextBest',        displayName: 'Pairs with your bag (next best product)' },
      ],
    },
    productHandles: {
      type:        'string',
      maxLength:   600,
      displayName: 'Hand-picked Products',
      description: 'Catalog source + Hand-picked: comma-separated product handles, in display order (e.g. loden-wool-car-coat, oversized-lambswool-scarf).',
      group:       'OT_Content',
      sortOrder:   27,
    },
    categoryHandle: {
      type:        'string',
      maxLength:   80,
      displayName: 'Catalog Category',
      description: 'Catalog source + Trending / From a category: limit to a category handle (e.g. women-knitwear). Blank = whole catalog.',
      group:       'OT_Content',
      sortOrder:   28,
    },
    showAllLabel: {
      type:        'string',
      isLocalized: true,
      maxLength:   40,
      displayName: 'Show-All Label',
      description: 'Label for the control that reveals the remaining recommendations. Defaults to "Show all".',
      group:       'OT_Content',
      sortOrder:   50,
    },
  },
})
