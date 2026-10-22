import { draftMode } from 'next/headers'
import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_CommerceFlowBlock as OT_CommerceFlowBlockContentType } from '@/cms/content-types/OT_CommerceFlowBlock'
import CommerceFlowBlock, { type CommerceFlowMode } from '@/components/blocks/CommerceFlowBlock'
import type { SummaryStyle } from '@/components/commerce/flow/OrderSummary'
import { getRequestDomain } from '@/lib/optimizely'
import { getCommerceSettings } from '@/lib/commerce/settings'

type Props = {
  content:          ContentProps<typeof OT_CommerceFlowBlockContentType>
  displaySettings?: Record<string, string | boolean>
}

const MODES: CommerceFlowMode[] = ['bag', 'checkout', 'confirmation', 'wishlist']
const SUMMARY: SummaryStyle[] = ['surface', 'brand', 'ruled']

/** Same-site absolute CMS URLs → paths, so the shared Button doesn't open them in a new tab. */
function sitePath(url: string | null | undefined, domain: string): string | undefined {
  if (!url) return undefined
  if (url.startsWith('/')) return url
  try {
    const u = new URL(url)
    return u.host === domain ? `${u.pathname}${u.search}` : url
  } catch {
    return undefined
  }
}

export default async function OT_CommerceFlowBlockAdapter({ content, displaySettings = {} }: Props) {
  const { pa } = getPreviewUtils(content)
  const domain = await getRequestDomain()
  const commerce = await getCommerceSettings(domain)

  if (!commerce) {
    const { isEnabled } = await draftMode()
    return isEnabled ? (
      <div {...pa(content.__composition)} className="w-full px-md py-lg text-sm text-fg-muted">
        Commerce Flow: mock commerce is not enabled for this site (ThemeManager → Integrations → Enable Mock Commerce).
      </div>
    ) : null
  }

  const mode = MODES.includes(content.mode as CommerceFlowMode) ? (content.mode as CommerceFlowMode) : 'bag'
  const summaryStyle = SUMMARY.includes(displaySettings.summaryStyle as SummaryStyle) ? (displaySettings.summaryStyle as SummaryStyle) : 'surface'

  return (
    <div {...pa(content.__composition)} className="w-full">
      <CommerceFlowBlock
        mode={mode}
        color={displaySettings.color === 'surface' ? 'surface' : 'canvas'}
        heading={content.heading ?? undefined}
        emptyMessage={content.emptyMessage ?? undefined}
        continueLabel={content.continueLabel ?? undefined}
        continueUrl={sitePath(content.continueUrl?.default, domain)}
        assurance={content.assurance ?? undefined}
        summaryStyle={summaryStyle}
      />
    </div>
  )
}
