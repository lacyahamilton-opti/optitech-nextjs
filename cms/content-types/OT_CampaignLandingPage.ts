import { contentType } from '@optimizely/cms-sdk'
import { OT_FooterBlock } from './OT_FooterBlock'
import { enableExternalPreviewProperty } from './_shared/externalPreview'

// ─── OT_CampaignLandingPage ───────────────────────────────────────────────────
// A standalone campaign landing page. It renders WITHOUT the site header, site
// search or site footer (app/(site)/layout.tsx asks lib/shellMode.ts, which keys
// on this type). The slug route supplies a locked frame instead: a slim campaign
// strip (logo, "return to main site", call to action) above the editor's free
// Visual Builder composition, and a footer chosen on the page.
//
// The identity is a PRESET, not a pile of knobs: the editor picks one named look
// (Blueprint, Neon, Comic, Stage) and each look fixes its own mode, so there is
// no separate light/dark field. Looks draw their palette from the site's ThemeManager
// colors, so every vertical keeps its own identity; an optional accent override
// replaces the seed color for this one campaign. See lib/campaign-looks.ts and
// components/campaign/campaign-looks.css.
//
// MUST stay `_experience` (Visual Builder composition and content variations).
// As an `_experience` it needs no adapter or display template; the slug route
// renders it directly. The "return to main site" link needs no field: it always
// targets the home of the current site, in the visitor's language.

export const OT_CampaignLandingPage = contentType({
  key:         'OT_CampaignLandingPage',
  displayName: 'Campaign Landing Page',
  description: 'A standalone landing page with no site navigation. Shows a slim campaign strip and its own footer around a free Visual Builder composition.',
  baseType:    '_experience',
  mayContainTypes: ['*'],
  properties: {
    enableExternalPreview: enableExternalPreviewProperty,

    // ── Look ────────────────────────────────────────────────────────────────
    campaignLook: {
      type:        'string',
      format:      'selectOne',
      displayName: 'Campaign Look',
      description: 'The visual identity of this page. Blueprint: light drafting-sheet style, with fine grid paper, linework frames and figure labels. Neon: 80s neon signage, with a night brick wall, glowing tube lettering and a neon frame. Comic: light, bold comic-book style with ink outlines and hard shadows. Stage: near-black with a single hot accent and a spotlight. Defaults to Blueprint.',
      enum: [
        { value: 'blueprint', displayName: 'Blueprint (light, drafting sheet)' },
        { value: 'neon',      displayName: 'Neon (dark, glowing signage)' },
        { value: 'comic',     displayName: 'Comic (light, bold ink)' },
        { value: 'stage',     displayName: 'Stage (near-black, spotlight)' },
      ],
      group:       'OT_Style',
      sortOrder:   10,
    },
    accentOverride: {
      type:        'string',
      maxLength:   7,
      displayName: 'Campaign Color (optional)',
      description: 'Leave blank to use the site brand colors (recommended). To give this one campaign its own color, enter a bold, saturated hex such as #e4572e; the whole look is built from it and stays readable. Greys and near-greys (#333, #999) have no color to build from and are ignored.',
      group:       'OT_Style',
      sortOrder:   20,
    },
    motionLevel: {
      type:        'string',
      format:      'selectOne',
      displayName: 'Motion',
      description: 'How much the page moves. Full: ambient background motion and scroll reveals. Calm: slower, fewer moving parts. Still: nothing animates. Visitors who ask their device for reduced motion always get Still.',
      enum: [
        { value: 'full',  displayName: 'Full' },
        { value: 'calm',  displayName: 'Calm' },
        { value: 'still', displayName: 'Still' },
      ],
      group:       'OT_Style',
      sortOrder:   30,
    },

    // ── Campaign strip ──────────────────────────────────────────────────────
    ctaLabel: {
      type:        'string',
      isLocalized: true,
      maxLength:   40,
      displayName: 'Call to Action Label',
      description: 'Button text in the campaign strip, which stays visible as the visitor scrolls. Leave blank to hide the button.',
      group:       'OT_Content',
      sortOrder:   10,
    },
    ctaUrl: {
      type:        'url',
      displayName: 'Call to Action URL',
      description: 'Where the strip button goes. Use an on-page anchor (e.g. #request-information) to scroll to a form section, or a full URL.',
      group:       'OT_Content',
      sortOrder:   20,
    },
    returnLabel: {
      type:        'string',
      isLocalized: true,
      maxLength:   40,
      displayName: 'Return Link Label',
      description: 'Text of the link back to the main site. Falls back to a translated "Return to main site" when blank.',
      group:       'OT_Content',
      sortOrder:   30,
    },

    // ── Conversion ──────────────────────────────────────────────────────────
    formRef: {
      type:         'contentReference',
      allowedTypes: ['OptiFormsContainerData'],
      displayName:  'Request Information Form',
      description:  'Optional form rendered in a locked section above the footer. It is the target of the strip button when the button URL is #request-information.',
      group:        'OT_Content',
      sortOrder:    35,
    },
    formHeading: {
      type:        'string',
      isLocalized: true,
      maxLength:   80,
      displayName: 'Form Section Heading',
      description: 'Heading above the form. Falls back to a translated "Request information" when blank.',
      group:       'OT_Content',
      sortOrder:   36,
    },

    // ── Footer ──────────────────────────────────────────────────────────────
    footerRef: {
      type:         'contentReference',
      allowedTypes: [OT_FooterBlock],
      displayName:  'Campaign Footer',
      description:  'The footer block shown at the bottom of this page. Leave blank for a minimal footer with the return link and copyright.',
      group:        'OT_Content',
      sortOrder:    40,
    },

    // ── SEO / Search & Discovery ────────────────────────────────────────────
    seoTitle: {
      type:         'string',
      isLocalized:  true,
      displayName:  'Page Title',
      description:  'Appears in the browser tab and search results. Recommended 50–60 characters. Falls back to Site Name if blank.',
      group:        'OT_SEO',
      sortOrder:    10,
      indexingType: 'searchable',
    },
    seoDescription: {
      type:         'string',
      isLocalized:  true,
      displayName:  'Meta Description',
      description:  'Appears in search engine result snippets. Recommended 120–160 characters. Falls back to the site-level Default Meta Description.',
      group:        'OT_SEO',
      sortOrder:    20,
      indexingType: 'searchable',
    },
    canonicalUrl: {
      type:        'url',
      displayName: 'Canonical URL',
      description: "Override only. Leave blank to use the page's own URL.",
      group:       'OT_SEO',
      sortOrder:   30,
    },
    ogImage: {
      type:         'contentReference',
      allowedTypes: ['_image'],
      displayName:  'Social Share Image',
      description:  'Image shown when this page is shared on social platforms. Recommended 1200×630px. Falls back to the site default.',
      group:        'OT_SEO',
      sortOrder:    40,
    },
    pageAnswer: {
      type:         'string',
      isLocalized:  true,
      displayName:  'AI Answer Summary',
      description:  'A 1–3 sentence plain-language answer to the primary question this page addresses. Used in structured data and as a direct signal to AI answer engines. Write as if answering the question directly — no marketing language.',
      group:        'OT_SEO',
      sortOrder:    50,
      indexingType: 'searchable',
    },
    schemaType: {
      type:        'string',
      format:      'selectOne',
      displayName: 'Schema Type',
      description: 'The structured data type for this page. Controls which JSON-LD block is generated.',
      enum: [
        { value: 'none',    displayName: 'None' },
        { value: 'WebPage', displayName: 'Web Page' },
        { value: 'Article', displayName: 'Article' },
        { value: 'FAQPage', displayName: 'FAQ Page' },
        { value: 'Product', displayName: 'Product' },
        { value: 'Event',   displayName: 'Event' },
      ],
      group:       'OT_SEO',
      sortOrder:   60,
    },
    noIndex: {
      type:        'boolean',
      displayName: 'Hide from Search Engines',
      description: 'When enabled, adds noindex/nofollow robots directives and excludes this page from the sitemap.',
      group:       'OT_SEO',
      sortOrder:   70,
    },
    customSchemaJson: {
      type:        'string',
      displayName: 'Custom Schema JSON (Advanced)',
      description: 'Developer escape hatch. Paste a valid JSON-LD object here to override or extend the generated structured data. Must be valid JSON. Merged with the generated schema — do not include @context.',
      group:       'OT_SEO',
      sortOrder:   80,
    },
  },
})
