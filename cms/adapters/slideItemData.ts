import type { SlideData } from '@/components/blocks/SliderBlock'
import { richTextJson } from '@/lib/richTextJson'

/**
 * Maps one OT_SlideItem content object into the flat SlideData shape every
 * Presentation Style component renders — built once here so switching
 * `presentationStyle` never requires different data plumbing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSlideItemFromContent(item: any, src: (ref: any) => string | undefined): SlideData {
  return {
    key:                String(item?._metadata?.key ?? item?.headline ?? ''),
    eyebrow:            item?.eyebrow  ?? undefined,
    headline:           item?.headline ?? undefined,
    // CMS delivers rich text as { json }; showcase/mock data may pass a plain string.
    body:               richTextJson(item?.body) ?? (typeof item?.body === 'string' ? item.body : undefined),
    buttonLabel:        item?.buttonLabel        ?? undefined,
    buttonUrl:          item?.buttonUrl?.default  ?? item?.buttonUrl  ?? undefined,
    secondaryLabel:      item?.secondaryLabel      ?? undefined,
    secondaryUrl:        item?.secondaryUrl?.default ?? item?.secondaryUrl ?? undefined,
    backgroundImageSrc: src(item?.backgroundImage) ?? item?.backgroundImageSrc ?? undefined,
    backgroundImageAlt: item?.backgroundImageAlt ?? '',
    backgroundVideoSrc: src(item?.backgroundVideo) ?? item?.backgroundVideoSrc ?? undefined,
    backgroundColor:    (item?.backgroundColor ?? 'canvas') as SlideData['backgroundColor'],
    overlay:            (item?.overlay ?? 'evenTint') as SlideData['overlay'],
    contentPlacement:   (item?.contentPlacement ?? 'left') as SlideData['contentPlacement'],
  }
}
