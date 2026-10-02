// ─── Shared showcase navigation config ───────────────────────────────────────

// `href` overrides the default `/showcase/<category>/<slug>` route — used for
// in-page anchor links (e.g. the Theme playground's section jumps).
// `group` opts a category into the nav's grouped-mega-menu layout (sorted
// alphabetically within each group, groups in the order they first appear in
// the array below). Categories that leave every item's `group` unset keep
// rendering in plain array order — e.g. Theme's items are deliberately
// ordered to match the playground's own section order, not alphabetically.
export type ShowcaseItem = { label: string; slug: string; href?: string; group?: string }

export type ShowcaseCategory = {
  label: string
  slug: string
  match: string  // pathname prefix for active detection
  href: string   // where the category tab navigates to
  items: ShowcaseItem[]
}

export const CATEGORIES: ShowcaseCategory[] = [
  {
    label: 'Blocks',
    slug:  'blocks',
    match: '/showcase/blocks',
    href:  '/showcase/blocks/hero',
    // Grouped for the mega-menu (see ShowcaseItem['group'] doc above) —
    // groups appear in this order, items alphabetical within each group.
    items: [
      // Hero & Content
      { label: 'Callout',      slug: 'callout',      group: 'Hero & Content' },
      { label: 'Divider',      slug: 'divider',      group: 'Hero & Content' },
      { label: 'Hero',         slug: 'hero',         group: 'Hero & Content' },
      { label: 'Primary Text', slug: 'primary-text', group: 'Hero & Content' },
      { label: 'Quote',        slug: 'quote',        group: 'Hero & Content' },
      { label: 'Rich Text',    slug: 'rich-text',    group: 'Hero & Content' },

      // Media
      { label: 'Banner', slug: 'banner', group: 'Media' },
      { label: 'Image',  slug: 'image',  group: 'Media' },
      { label: 'Slider', slug: 'slider', group: 'Media' },
      { label: 'Video',  slug: 'video',  group: 'Media' },

      // Data & Metrics
      { label: 'Chart',            slug: 'chart',            group: 'Data & Metrics' },
      { label: 'Comparison Table', slug: 'comparison-table', group: 'Data & Metrics' },
      { label: 'Stat',             slug: 'stat',             group: 'Data & Metrics' },
      { label: 'Stat Item',        slug: 'stat-item',        group: 'Data & Metrics' },
      { label: 'Token Manager',    slug: 'token-manager',    group: 'Data & Metrics' },

      // Listings & Feeds
      { label: 'Blog Feed',                slug: 'blog-feed',                group: 'Listings & Feeds' },
      { label: 'Content Recommendations',  slug: 'content-recommendations',  group: 'Listings & Feeds' },
      { label: 'Event Listing',            slug: 'event-listing',            group: 'Listings & Feeds' },
      { label: 'Industry News Feed',       slug: 'industry-news-feed',       group: 'Listings & Feeds' },
      { label: 'Location Listing',         slug: 'location-listing',         group: 'Listings & Feeds' },
      { label: 'Practitioner Listing',     slug: 'practitioner-listing',     group: 'Listings & Feeds' },
      { label: 'Product Recommendations',  slug: 'product-recommendations',  group: 'Listings & Feeds' },
      { label: 'Resource Library',         slug: 'resource-library',         group: 'Listings & Feeds' },
      { label: 'Trust Rail',               slug: 'trust-rail',               group: 'Listings & Feeds' },

      // Structure & Interaction
      { label: 'Accordion',    slug: 'accordion',    group: 'Structure & Interaction' },
      { label: 'Card',         slug: 'card',         group: 'Structure & Interaction' },
      { label: 'Disclosure',   slug: 'disclosure',   group: 'Structure & Interaction' },
      { label: 'Feature Grid', slug: 'feature-grid', group: 'Structure & Interaction' },
      { label: 'Feature Item', slug: 'feature-item', group: 'Structure & Interaction' },
      { label: 'Tab Item',     slug: 'tab-item',     group: 'Structure & Interaction' },
      { label: 'Tabs',         slug: 'tabs',         group: 'Structure & Interaction' },

      // Actions
      { label: 'Button', slug: 'button', group: 'Actions' },
      { label: 'Forms',  slug: 'forms',  group: 'Actions' },
    ],
  },
  {
    label: 'Pages',
    slug:  'pages',
    match: '/showcase/pages',
    href:  '/showcase/pages/blog',
    items: [
      { label: 'Blog',      slug: 'blog'      },
      { label: 'Event',     slug: 'event'     },
      { label: 'Topic Hub', slug: 'topic-hub' },
      { label: 'Folder',    slug: 'folder'    },
    ],
  },
  {
    label: 'Layout',
    slug:  'layout',
    match: '/showcase/layout',
    href:  '/showcase/layout/row-rhythm',
    items: [
      { label: 'Row Rhythm',        slug: 'row-rhythm'       },
      { label: 'Section Overlap',   slug: 'section-overlap'  },
      { label: 'Carousel',          slug: 'carousel'         },
      { label: 'Row Settings',      slug: 'row-settings'     },
      { label: 'Section Settings',  slug: 'section-settings' },
    ],
  },
  {
    label: 'Theme',
    slug:  'theme',
    match: '/showcase/theme',
    href:  '/showcase/theme',
    // Single live playground; sub-items jump to preview sections on the page.
    items: [
      { label: 'Colors',        slug: 'colors',     href: '/showcase/theme#colors'     },
      { label: 'Typography',    slug: 'typography', href: '/showcase/theme#typography' },
      { label: 'Buttons',       slug: 'buttons',    href: '/showcase/theme#buttons'    },
      { label: 'Form Elements', slug: 'inputs',     href: '/showcase/theme#inputs'     },
      { label: 'Spacing',       slug: 'spacing',    href: '/showcase/theme#spacing'    },
      { label: 'Motion',        slug: 'motion',     href: '/showcase/theme#motion'     },
    ],
  },
]

export function getCategoryForPath(pathname: string): ShowcaseCategory | null {
  return CATEGORIES.find(c => pathname.startsWith(c.match)) ?? null
}
