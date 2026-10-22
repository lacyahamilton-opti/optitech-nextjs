import type { MetadataRoute } from 'next'
import { getRequestBaseUrl } from '@/lib/optimizely'
import { AI_CRAWLERS, INDEXING_ALLOWED } from '@/lib/indexing'

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Per request host: one deployment serves several demo domains, and each
  // must point crawlers at its own sitemap.
  const siteUrl = await getRequestBaseUrl()

  return {
    rules: [
      // Crawling stays open on purpose. Keeping search results clean is done with a
      // noindex header (see lib/indexing.ts), which a crawler only sees if it may fetch the page.
      { userAgent: '*', allow: '/', disallow: ['/api/', '/opti-admin/'] },

      // AI answer engines and assistants: explicitly permitted for demo analysis
      ...AI_CRAWLERS.map(userAgent => ({ userAgent, allow: '/' })),
    ],
    // Do not hand search engines a sitemap unless indexing is enabled.
    sitemap: INDEXING_ALLOWED && siteUrl ? `${siteUrl}/sitemap.xml` : undefined,
  }
}
