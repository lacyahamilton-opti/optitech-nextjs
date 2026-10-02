/**
 * Industry news feed registry — the single source of truth for which external
 * feeds can be rendered. The browser/CMS only ever supplies a `feedId`; the
 * server resolves it here to a hard-coded URL (no client-supplied URLs → no SSRF).
 *
 * LICENSING: these are commercial publishers' feeds. Their terms of use MUST be
 * reviewed before any production use on a client site. We show headline, short
 * summary and thumbnail only, always link out, and always attribute.
 *
 * Adding/removing a vertical is a registry change only — the CMS picklist and
 * request validation are derived from this array.
 */

export type FeedFormat = 'rss' | 'atom'

export type FeedEntry = {
  id:             string
  /** Vertical name shown in the CMS picklist */
  label:          string
  sourceName:     string
  url:            string
  format:         FeedFormat
  /** Publisher homepage, used for the attribution / escape-hatch link */
  homepage:       string
  expectsImages:  boolean
  enabled:        boolean
}

export const FEED_REGISTRY: readonly FeedEntry[] = [
  { id: 'healthcare',  label: 'Healthcare',  sourceName: 'Healthcare Dive',   url: 'https://www.healthcaredive.com/feeds/news/', format: 'rss', homepage: 'https://www.healthcaredive.com/',   expectsImages: true,  enabled: true },
  { id: 'banking',     label: 'Banking',     sourceName: 'Banking Dive',      url: 'https://www.bankingdive.com/feeds/news/',    format: 'rss', homepage: 'https://www.bankingdive.com/',      expectsImages: true,  enabled: true },
  { id: 'retail',      label: 'Retail',      sourceName: 'Retail Dive',       url: 'https://www.retaildive.com/feeds/news/',     format: 'rss', homepage: 'https://www.retaildive.com/',       expectsImages: true,  enabled: true },
  { id: 'hospitality', label: 'Hospitality', sourceName: 'Hotel Dive',        url: 'https://www.hoteldive.com/feeds/news/',      format: 'rss', homepage: 'https://www.hoteldive.com/',        expectsImages: true,  enabled: true },
  { id: 'insurance',   label: 'Insurance',   sourceName: 'Insurance Journal', url: 'https://www.insurancejournal.com/rss/news/', format: 'rss', homepage: 'https://www.insurancejournal.com/', expectsImages: true,  enabled: true },
  { id: 'legal',       label: 'Legal',       sourceName: 'SCOTUSblog',        url: 'https://www.scotusblog.com/feed/',           format: 'rss', homepage: 'https://www.scotusblog.com/',       expectsImages: true,  enabled: true },
  { id: 'technology',  label: 'Technology',  sourceName: 'CIO Dive',          url: 'https://www.ciodive.com/feeds/news/',        format: 'rss', homepage: 'https://www.ciodive.com/',          expectsImages: true,  enabled: true },

  // Alternatives — disabled until verified from our own environment.
  { id: 'technology-wired', label: 'Technology (Wired)',  sourceName: 'WIRED', url: 'https://www.wired.com/feed/rss',               format: 'rss', homepage: 'https://www.wired.com/', expectsImages: true,  enabled: false },
  { id: 'healthcare-nih',   label: 'Healthcare (NIH)',    sourceName: 'NIH',   url: 'https://www.nih.gov/news-releases/feed.xml',   format: 'rss', homepage: 'https://www.nih.gov/',   expectsImages: false, enabled: false },
]

export function enabledFeeds(): FeedEntry[] {
  return FEED_REGISTRY.filter(f => f.enabled)
}

/** Allowlist lookup. Returns only enabled entries; unknown/disabled → undefined. */
export function getEnabledFeed(id: unknown): FeedEntry | undefined {
  if (typeof id !== 'string') return undefined
  return FEED_REGISTRY.find(f => f.enabled && f.id === id)
}
