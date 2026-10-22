import { contentType } from '@optimizely/cms-sdk'

// ─── OT_ProductListingBlock ───────────────────────────────────────────────────
// A product listing (PLP) over the Optimizely Graph product catalog — the
// storefront's category/collection grid with facets, sort and "show more".
// Editors drop it on a category page (Women, Coats & Jackets, New In, Archive)
// and scope it with Category / Collection / Badge; facet options are derived
// from the loaded products, never a fixed list.
//
// Products are not CMS content: the adapter reads them from lib/catalog.ts for
// the site's catalog (ThemeManager → Product Catalog ID). On sites without mock
// commerce enabled the block renders an unconfigured notice to editors only.
//
// The optional editorial tile is a brand-filled card slotted into the grid —
// the committed-colour moment on an otherwise image-led page.

export const OT_ProductListingBlock = contentType({
  key:         'OT_ProductListingBlock',
  displayName: 'Product Listing',
  description: 'Filterable, sortable product grid from the Graph product catalog. Scope it by category, collection or badge.',
  baseType:    '_component',
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'],
  properties: {
    heading: {
      type: 'string', isLocalized: true, maxLength: 80, displayName: 'Heading',
      description: 'Optional heading above the grid ("Coats & Jackets", "New this week").',
      group: 'OT_Content', sortOrder: 10, indexingType: 'searchable',
    },
    subtext: {
      type: 'string', isLocalized: true, maxLength: 200, displayName: 'Subtext',
      group: 'OT_Content', sortOrder: 20,
    },
    categoryHandle: {
      type: 'string', maxLength: 80, displayName: 'Category',
      description: 'Catalog category handle to list (women, women-knitwear, men-coats-and-jackets, accessories-bags…). Blank = whole catalog. Sub-categories become a filter automatically.',
      group: 'OT_Content', sortOrder: 30,
    },
    collection: {
      type: 'string', format: 'selectOne', displayName: 'Collection',
      description: 'Optionally limit to one collection.',
      enum: [
        { value: 'all',            displayName: 'All collections' },
        { value: 'low-light-aw26', displayName: 'Autumn/Winter 2026' },
        { value: 'core',           displayName: 'Core' },
        { value: 'gift-edit',      displayName: 'Gift Edit' },
        { value: 'archive',        displayName: 'Archive' },
      ],
      group: 'OT_Content', sortOrder: 40,
    },
    badge: {
      type: 'string', format: 'selectOne', displayName: 'Badge',
      description: 'Optionally limit to products carrying a badge (e.g. New for a New In page).',
      enum: [
        { value: 'any',        displayName: 'Any' },
        { value: 'new',        displayName: 'New' },
        { value: 'bestseller', displayName: 'Bestseller' },
        { value: 'limited',    displayName: 'Limited run' },
      ],
      group: 'OT_Content', sortOrder: 50,
    },
    defaultSort: {
      type: 'string', format: 'selectOne', displayName: 'Default Sort',
      enum: [
        { value: 'featured',  displayName: 'Featured (merchandised order)' },
        { value: 'newest',    displayName: 'Newest' },
        { value: 'priceAsc',  displayName: 'Price: low to high' },
        { value: 'priceDesc', displayName: 'Price: high to low' },
        { value: 'rating',    displayName: 'Top rated' },
      ],
      group: 'OT_Content', sortOrder: 60,
    },
    pageSize: {
      type: 'string', format: 'selectOne', displayName: 'Products per Page',
      description: 'How many products show before "Show more".',
      enum: [
        { value: '8',  displayName: '8' },
        { value: '12', displayName: '12' },
        { value: '24', displayName: '24' },
      ],
      group: 'OT_Content', sortOrder: 70,
    },
    emptyMessage: {
      type: 'string', isLocalized: true, maxLength: 120, displayName: 'Empty Message',
      description: 'Shown when filters match nothing. Defaults to "No pieces match these filters."',
      group: 'OT_Content', sortOrder: 80,
    },

    // ── Editorial tile (optional) ─────────────────────────────────────────────
    tileEyebrow: {
      type: 'string', isLocalized: true, maxLength: 40, displayName: 'Editorial Tile — Eyebrow',
      description: 'Leave the tile heading blank to hide the tile.',
      group: 'OT_Content', sortOrder: 100,
    },
    tileHeading: {
      type: 'string', isLocalized: true, maxLength: 80, displayName: 'Editorial Tile — Heading',
      description: 'A brand-coloured tile placed in the grid (e.g. "The knit guide"). Hidden while filters are active.',
      group: 'OT_Content', sortOrder: 110,
    },
    tileBody: {
      type: 'string', isLocalized: true, maxLength: 200, displayName: 'Editorial Tile — Body',
      group: 'OT_Content', sortOrder: 120,
    },
    tileCtaLabel: {
      type: 'string', isLocalized: true, maxLength: 40, displayName: 'Editorial Tile — CTA Label',
      group: 'OT_Content', sortOrder: 130,
    },
    tileCtaUrl: {
      type: 'url', displayName: 'Editorial Tile — CTA URL',
      group: 'OT_Content', sortOrder: 140,
    },
  },
})
