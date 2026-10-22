import { cache } from 'react'
import { getLocalizedContentByPath } from '@/lib/optimizely'
import type { Locale } from '@/lib/i18n/config'

// Per-request content cache shared by the site layout and the catch-all page.
// React cache() deduplicates identical calls within one render pass, so the
// layout's shell decision and the page's own fetch cost a single Graph query.
export const fetchPageContent = cache(async (path: string, locale: Locale, baseUrl: string) =>
  getLocalizedContentByPath(path, locale, baseUrl),
)
