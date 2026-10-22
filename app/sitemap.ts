import type { MetadataRoute } from 'next'
import { getClient, getRequestBaseUrl, getRequestDomain } from '@/lib/optimizely'
import { getCommerceSettings } from '@/lib/commerce/settings'
import { getAllHandles } from '@/lib/catalog'

// Published BlankExperience and OT_BlogPage items for ONE site: filtered by the
// Graph channel base URL, so each domain on the shared CMS instance gets a
// sitemap of its own pages only (not every site's). `url.default` is the
// canonical relative URL stored by Content Graph.
const SITEMAP_QUERY = `
  query GetPublishedPages($base: String) {
    BlankExperience(
      where: { _metadata: { status: { eq: "Published" }, url: { base: { eq: $base } } } }
      limit: 200
    ) {
      items {
        _metadata { url { default } lastModified published }
        noIndex
      }
    }
    OT_BlogPage(
      where: { _metadata: { status: { eq: "Published" }, url: { base: { eq: $base } } } }
      limit: 200
    ) {
      items {
        _metadata { url { default } lastModified published }
        noIndex
      }
    }
  }
`

type Entry = MetadataRoute.Sitemap[number]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The request host decides the site. Absolute URLs use the same origin so a
  // single deployment serving several domains emits correct URLs for each.
  const baseUrl = await getRequestBaseUrl()
  if (!baseUrl) return []

  const entries: Entry[] = []
  const seen = new Set<string>()
  const push = (e: Entry | null) => {
    if (!e || seen.has(e.url)) return
    seen.add(e.url)
    entries.push(e)
  }

  try {
    const data = await getClient().request(SITEMAP_QUERY, { base: baseUrl })
    const items = [
      ...((data?.BlankExperience?.items ?? []) as any[]),
      ...((data?.OT_BlogPage?.items ?? []) as any[]),
    ]
    for (const item of items) {
      if (item.noIndex) continue
      const raw = item._metadata?.url?.default as string | null | undefined
      if (!raw) continue
      let url: URL
      try {
        url = new URL(raw, baseUrl)
      } catch {
        continue
      }
      const rawDate = item._metadata?.lastModified ?? item._metadata?.published
      const isHome = url.pathname === '/'
      push({
        url: `${baseUrl}${url.pathname}`,
        lastModified: rawDate ? new Date(rawDate) : undefined,
        changeFrequency: isHome ? 'daily' : 'weekly',
        priority: isHome ? 1.0 : 0.8,
      })
    }
  } catch {
    /* Graph unavailable — fall through with whatever we have */
  }

  // Storefront sites: every catalog product page (served from the Graph
  // product source, not CMS pages, so the query above can't see them).
  const commerce = await getCommerceSettings(await getRequestDomain())
  if (commerce) {
    for (const handle of await getAllHandles(commerce.catalogId)) {
      push({ url: `${baseUrl}/products/${handle}`, changeFrequency: 'weekly', priority: 0.7 })
    }
  }

  return entries
}
