import { draftMode } from 'next/headers'
import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_BlogFeedBlock as OT_BlogFeedBlockContentType } from '@/cms/content-types/OT_BlogFeedBlock'
import { getRequestLocale, getRequestBaseUrl } from '@/lib/optimizely'
import { getBlogFeedPosts }  from '@/lib/blogFeed'
import BlogFeedBlock         from '@/components/blocks/BlogFeedBlock'
import type { BlogFeedColor, BlogFeedColumns, BlogFeedHeadingSize, BlogFeedView } from '@/components/blocks/BlogFeedBlock'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  content:          ContentProps<typeof OT_BlogFeedBlockContentType>
  displaySettings?: Record<string, string | boolean>
}

// ─── OT_BlogFeedBlock adapter ─────────────────────────────────────────────────
//
// Async server component — fetches blog posts at render time using the current
// locale (set by middleware → getRequestLocale) so the feed is always in sync
// with the active language without any client round-trips.
//
// The article root's hierarchical URL is read directly from the content
// reference metadata returned by the SDK (the _IContent fragment includes
// url.hierarchical), which avoids an extra Graph query to resolve the root.

export default async function OT_BlogFeedBlockAdapter({
  content,
  displaySettings = {},
}: Props) {
  const { pa } = getPreviewUtils(content)
  // The interactive filter drawer is a live-front-end feature only — the CMS
  // editor's Visual Builder canvas and any other draft/preview render leave it
  // permanently mounted off-screen (skewed, translated out), which showed up
  // as a stray shape bleeding into the editing iframe.
  //
  // content.__context.edit is the SDK's own, content-scoped signal for "this
  // is being served into CMS edit/preview" — set by the CMS itself whenever
  // it hands this content to Visual Builder, regardless of which internal
  // rendering path VB uses. draftMode() (this repo's other preview signal,
  // used by app/(site)/[...slug]/page.tsx and the draft block route) is kept
  // as a second, independent check: VB apparently doesn't always carry the
  // Next.js draft-mode cookie, which is exactly how this slipped through
  // before — so neither signal alone is trusted on its own.
  const { isEnabled: draftModeEnabled } = await draftMode()
  const isPreview = draftModeEnabled || content.__context?.edit === true

  // ── Locale + site base URL ────────────────────────────────────────────────
  // getRequestLocale reads the x-locale header set by middleware; falls back
  // to the default locale when called outside a request context (e.g. build).
  // getRequestBaseUrl provides the current site's origin for scoping the feed
  // to only this site's blog posts (Content Graph is shared across all sites).
  const locale      = await getRequestLocale()
  const siteBaseUrl = await getRequestBaseUrl()

  // ── Article root ──────────────────────────────────────────────────────────
  // The SDK's generated fragment includes _metadata.url.hierarchical for
  // contentReference fields, so we can read it directly from content.articleRoot.
  const articleRootPath: string | null =
    content.articleRoot?.url?.hierarchical ?? null

  // ── Page size ─────────────────────────────────────────────────────────────
  const rawPageSize = content.pageSize ?? 0
  const pageSize    = Number.isInteger(rawPageSize) && rawPageSize >= 1
    ? Math.min(rawPageSize, 24)
    : 9

  // ── Topic filter ─────────────────────────────────────────────────────────
  // When the editor chooses a topic in the CMS, the feed is locked to that
  // topic at render time. Null means "no filter — show all topics".
  const topicFilter: string | null =
    typeof content.topicFilter === 'string' && content.topicFilter
      ? content.topicFilter
      : null

  // ── Fetch posts ───────────────────────────────────────────────────────────
  // React cache() dedups this call if multiple Blog Feed blocks appear on the
  // same page with the same locale + root + filter combination.
  // Site-URL scoping always applies, article root or not — the content type's
  // own description promises articleRoot scopes posts "on the site", and a
  // bare hierarchical-path-prefix match has no site/domain component, so it
  // cannot by itself exclude a different site whose content tree happens to
  // use an overlapping path (e.g. two sites both folder their posts under a
  // "/health-insights/"-shaped root). Applying both filters together (site
  // base AND article-root prefix) never wrongly excludes a legitimate
  // same-site post under the configured root — url.base identifies the site,
  // hierarchical identifies the sub-path; they're orthogonal.
  const { posts, topics } = await getBlogFeedPosts(locale, articleRootPath, siteBaseUrl || null, topicFilter)

  // ── Display settings ──────────────────────────────────────────────────────
  const color       = String(displaySettings.color       ?? 'canvas')   as BlogFeedColor
  const columns     = String(displaySettings.columns     ?? 'col3')     as BlogFeedColumns
  const headingSize = String(displaySettings.headingSize ?? 'headline') as BlogFeedHeadingSize
  const defaultView = String(displaySettings.defaultView ?? 'grid')     as BlogFeedView

  // ── Heading — localised field ─────────────────────────────────────────────
  // The heading property has isLocalized: true. The SDK resolves the correct
  // locale variant and exposes it as a plain string on content.heading.
  const heading = content.heading ?? undefined

  return (
    <div {...pa(content.__composition)} className="w-full">
      <BlogFeedBlock
        heading={heading}
        posts={posts}
        topics={topics}
        pageSize={pageSize}
        topicFilter={topicFilter}
        styleOptions={{ color, columns, headingSize, defaultView }}
        isPreview={isPreview}
        pa={pa}
      />
    </div>
  )
}
