import SliderBlockClient from './SliderBlock.client'
import type { SliderStyleOptions } from '@/cms/styling/OT_SliderBlock.styling'
import type { RichText } from '@optimizely/cms-sdk/react/richText'

export type PresentationStyle = 'cinematic' | 'editorialSplit' | 'storyRail' | 'emerge'
export type SlideColor   = 'canvas' | 'surface' | 'brand' | 'brandDeep' | 'accent'
export type SlideOverlay = 'none' | 'evenTint' | 'leftFade' | 'rightFade' | 'bottomFade' | 'brandWash' | 'frostedPanel'
export type SlidePlacement = 'left' | 'center' | 'right'

export type SlideData = {
  key:                 string
  eyebrow?:            string
  headline?:           string
  /** Rich-text JSON from the CMS, or a plain string (showcase / fallback). */
  body?:               Parameters<typeof RichText>[0]['content'] | string | null
  buttonLabel?:        string
  buttonUrl?:          string
  secondaryLabel?:     string
  secondaryUrl?:       string
  backgroundImageSrc?: string
  backgroundImageAlt?: string
  backgroundVideoSrc?: string
  backgroundColor:     SlideColor
  overlay:             SlideOverlay
  contentPlacement:    SlidePlacement
}

export type SliderBlockProps = {
  presentationStyle: PresentationStyle
  slides:             SlideData[]
  styleOptions:       SliderStyleOptions
}

export default function SliderBlock(props: SliderBlockProps) {
  return <SliderBlockClient {...props} />
}
