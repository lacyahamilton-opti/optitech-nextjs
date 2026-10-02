import { contentType } from '@optimizely/cms-sdk'
import { enabledFeeds } from '../../lib/feeds/registry'
import { layoutOptions } from '../../lib/feeds/layouts'

/**
 * OT_IndustryNewsFeedBlock — latest headlines from a pre-approved external
 * industry RSS/Atom feed. The editor picks an industry from a picklist; the
 * server resolves it to a registry-held URL (the CMS never stores a feed URL).
 *
 * The Industry picklist is generated from lib/feeds/registry.ts, and layout
 * choices from lib/feeds/layouts.ts — adding a vertical or layout never
 * touches this schema's logic. Re-run `yarn cms:push` after changing either.
 *
 * Boolean/number fields have no schema defaults: when left blank the adapter
 * applies the defaults (toggles on, 6 items, h2, first layout).
 */
export const OT_IndustryNewsFeedBlock = contentType({
  key:                  'OT_IndustryNewsFeedBlock',
  displayName:          'Industry News Feed',
  description:          'Latest headlines from a pre-approved industry news feed (headline, short summary, thumbnail; links out to the publisher).',
  baseType:             '_component',
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'],
  properties: {
    heading: {
      type: 'string', isLocalized: true, maxLength: 120, displayName: 'Heading',
      description: 'Optional. Defaults to "Latest industry news".',
      group: 'OT_Content', sortOrder: 10, indexingType: 'searchable',
    },
    headingLevel: {
      type: 'string', format: 'selectOne', displayName: 'Heading level',
      description: 'Semantic level of the heading (does not change its size). Defaults to H2.',
      group: 'OT_Content', sortOrder: 15,
      enum: [
        { value: 'h2', displayName: 'H2 (default)' },
        { value: 'h3', displayName: 'H3' },
        { value: 'h4', displayName: 'H4' },
      ],
    },
    industry: {
      type: 'string', format: 'selectOne', displayName: 'Industry',
      description: 'Which publisher feed to show. Required — nothing renders on the live site until one is chosen.',
      group: 'OT_Content', sortOrder: 20,
      enum: enabledFeeds().map(f => ({ value: f.id, displayName: `${f.label} — ${f.sourceName}` })),
    },
    itemCount: {
      type: 'integer', displayName: 'Number of items',
      description: 'How many stories to show, 1–12. Defaults to 6.',
      group: 'OT_Content', sortOrder: 30,
    },
    layout: {
      type: 'string', format: 'selectOne', displayName: 'Layout',
      group: 'OT_Content', sortOrder: 40,
      enum: layoutOptions.map(o => ({ value: o.value, displayName: o.displayName })),
    },
    showImage:   { type: 'boolean', displayName: 'Show image',              description: 'Only applies to stories that have an image. Default on.', group: 'OT_Content', sortOrder: 50 },
    showDate:    { type: 'boolean', displayName: 'Show date',               group: 'OT_Content', sortOrder: 60 },
    showSummary: { type: 'boolean', displayName: 'Show summary',            group: 'OT_Content', sortOrder: 70 },
    showSource:  { type: 'boolean', displayName: 'Show source attribution', description: 'Recommended on — the publisher is credited and linked.', group: 'OT_Content', sortOrder: 80 },
  },
})
