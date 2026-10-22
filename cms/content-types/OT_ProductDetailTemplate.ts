import { contentType } from '@optimizely/cms-sdk'
import { enableExternalPreviewProperty } from './_shared/externalPreview'

// ─── OT_ProductDetailTemplate ─────────────────────────────────────────────────
// The editor-owned half of every product detail page (PDP).
//
// Products are NOT CMS content — they live in the Optimizely Graph product
// source (lib/catalog.ts). A request for /products/<handle> that matches no CMS
// page is resolved by the slug route (lib/commerce/pdp.ts): the product comes
// from Graph and renders a LOCKED ProductHeader (gallery, swatches, sizes, add
// to bag) outside the composition tree; this template's Visual Builder
// composition renders below it — complete-the-look recs, care accordion, brand
// story, repairs banner. Editors compose the shared PDP content ONCE for the
// whole catalog, the same pattern as OT_PractitionerPage over its profile record.
//
// Targeting: a template with blank "Applies To" is the site default. Add more
// templates with "Applies To" set to specific handles (loden-wool-car-coat) or
// categories (category:women-knitwear) to vary the below-the-fold story for a
// hero product or a category. Most specific wins: handle → category → default.
// A handle template may also set Product Description (agent-written SKU copy,
// APP-013) with an empty layout: the description applies and the layout falls
// through to the category / default template.
//
// As an `_experience` it has no adapter and no display template; the slug route
// renders it. Like any experience it can bind an FX flag for PDP A/B tests.

export const OT_ProductDetailTemplate = contentType({
  key:         'OT_ProductDetailTemplate',
  displayName: 'Product Detail Template',
  description: 'Below-the-fold layout for product pages. Products come from the Graph catalog and render in a locked header above this composition. Blank "Applies To" = default for the whole site.',
  baseType:    '_experience',
  mayContainTypes: ['*'],
  properties: {
    enableExternalPreview: enableExternalPreviewProperty,

    // ── Content ─────────────────────────────────────────────────────────────
    appliesTo: {
      type:        'string',
      maxLength:   400,
      displayName: 'Applies To',
      description: 'Blank = the default template for every product on this site. Otherwise a comma-separated list of product handles (loden-wool-car-coat) and/or categories (category:women-knitwear). Most specific match wins: handle, then category, then default.',
      group:       'OT_Content',
      sortOrder:   10,
    },
    productDescription: {
      type:         'richText',
      isLocalized:  true,
      displayName:  'Product Description',
      description:  'Only when "Applies To" names a single product handle: replaces that product\'s catalog description on its page (e.g. copy written by the product description agent). Leave the layout empty to keep the default template\'s layout.',
      group:        'OT_Content',
      sortOrder:    15,
      indexingType: 'searchable',
    },
    previewHandle: {
      type:        'string',
      maxLength:   80,
      displayName: 'Preview Product',
      description: 'Product handle shown in the locked header while editing this template in Visual Builder (e.g. loden-wool-car-coat). Defaults to the first product in the catalog.',
      group:       'OT_Content',
      sortOrder:   20,
    },

    // ── SEO / Search & Discovery ──────────────────────────────────────────────
    // Same keys as BlankExperience / OT_PractitionerPage so lib/metadata.ts and
    // lib/structured-data.ts share one path. Blank fields fall back to the
    // product's own name, description and image.
    seoTitle: {
      type:         'string',
      displayName:  'Page Title Override',
      description:  'Leave blank — each product page uses the product name. Set only on a handle-specific template.',
      group:        'OT_SEO',
      sortOrder:    10,
      indexingType: 'searchable',
    },
    seoDescription: {
      type:         'string',
      displayName:  'Meta Description Override',
      description:  'Leave blank — each product page uses the product description.',
      group:        'OT_SEO',
      sortOrder:    20,
      indexingType: 'searchable',
    },
    noIndex: {
      type:        'boolean',
      displayName: 'Hide Product Pages from Search Engines',
      description: 'Adds noindex to every product page this template renders. The template page itself is always noindex.',
      group:       'OT_SEO',
      sortOrder:   70,
    },

    // ── Experimentation ───────────────────────────────────────────────────────
    FxFlagKey: {
      type:        'string',
      maxLength:   100,
      displayName: 'FX Content Experiment Flag Key',
      description: 'Optimizely Feature Experimentation flag key selecting a CMS variation of this template (FX variation key = CMS variation slug, lowercased). Leave blank to always serve the default.',
      group:       'OT_Integrations',
      sortOrder:   90,
    },
  },
})
