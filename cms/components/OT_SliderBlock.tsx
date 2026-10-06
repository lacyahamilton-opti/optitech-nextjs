import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_SliderBlock as OT_SliderBlockContentType } from '@/cms/content-types/OT_SliderBlock'
import { getSliderStyles } from '@/cms/styling/OT_SliderBlock.styling'
import { buildSlideItemFromContent } from '@/cms/adapters/slideItemData'
import SliderBlock from '@/components/blocks/SliderBlock'
import type { SlideData, PresentationStyle } from '@/components/blocks/SliderBlock'

type Props = {
  content:          ContentProps<typeof OT_SliderBlockContentType>
  displaySettings?: Record<string, string | boolean>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSlides(content: any, src: (ref: any) => string | undefined): SlideData[] {
  if (!Array.isArray(content.slideItems)) return []
  return (content.slideItems as any[])
    .map(item => buildSlideItemFromContent(item, src))
    .filter(s => s.headline || s.eyebrow || s.backgroundImageSrc || s.backgroundVideoSrc)
}

export default function OT_SliderBlockAdapter({ content, displaySettings = {} }: Props) {
  const { pa, src } = getPreviewUtils(content)
  const styleOptions = getSliderStyles(displaySettings)
  const slides       = buildSlides(content, src)
  const presentationStyle = (content.presentationStyle ?? 'cinematic') as PresentationStyle
  const entranceAnimation = String(displaySettings?.entranceAnimation ?? 'none')

  return (
    <div
      {...pa(content.__composition)}
      data-stagger={entranceAnimation !== 'none' ? entranceAnimation : undefined}
    >
      <SliderBlock
        presentationStyle={presentationStyle}
        slides={slides}
        styleOptions={styleOptions}
      />
    </div>
  )
}
