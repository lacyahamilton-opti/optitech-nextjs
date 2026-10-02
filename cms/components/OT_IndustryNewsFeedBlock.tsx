import { draftMode } from 'next/headers'
import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_IndustryNewsFeedBlock as OT_IndustryNewsFeedBlockContentType } from '@/cms/content-types/OT_IndustryNewsFeedBlock'
import { getRequestLocale } from '@/lib/optimizely'
import { getEnabledFeed } from '@/lib/feeds/registry'
import { getFeed } from '@/lib/feeds/service'
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT } from '@/lib/feeds/request'
import IndustryNewsFeed from '@/components/blocks/IndustryNewsFeed'

type Props = {
  content:          ContentProps<typeof OT_IndustryNewsFeedBlockContentType>
  displaySettings?: Record<string, string | boolean>
}

const on = (v: boolean | null | undefined) => v !== false

/**
 * Async server component: resolves the editor's industry choice against the
 * registry allowlist and fetches/normalizes server-side (no client round-trip,
 * no URL ever supplied by content).
 */
export default async function OT_IndustryNewsFeedBlockAdapter({ content, displaySettings = {} }: Props) {
  const { pa } = getPreviewUtils(content)
  const { isEnabled: draftModeEnabled } = await draftMode()
  const isPreview = draftModeEnabled || content.__context?.edit === true

  const entry = getEnabledFeed(content.industry)
  if (!entry) {
    // Live site: render nothing. Edit/preview: tell the editor what's missing.
    if (!isPreview) return null
    return (
      <div {...pa(content.__composition)} className="w-full px-md py-md lg:px-lg">
        <p role="note" className="text-body text-fg-muted">
          Industry News Feed — choose an Industry in the block properties to show headlines.
        </p>
      </div>
    )
  }

  const requested = Number.isFinite(content.itemCount) ? Math.trunc(content.itemCount as number) : DEFAULT_LIMIT
  const limit = Math.min(Math.max(requested, MIN_LIMIT), MAX_LIMIT)
  const level = content.headingLevel === 'h3' ? 3 : content.headingLevel === 'h4' ? 4 : 2

  const [result, locale] = await Promise.all([getFeed(entry, limit), getRequestLocale()])

  return (
    <div {...pa(content.__composition)} className="w-full">
      <IndustryNewsFeed
        heading={content.heading || 'Latest industry news'}
        headingLevel={level}
        result={result}
        color={displaySettings.color === 'surface' ? 'surface' : 'canvas'}
        showImage={on(content.showImage)}
        showDate={on(content.showDate)}
        showSummary={on(content.showSummary)}
        showSource={on(content.showSource)}
        locale={locale}
        pa={pa}
      />
    </div>
  )
}
