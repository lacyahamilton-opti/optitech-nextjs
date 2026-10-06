'use client'

import { useMemo } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSliderEngine } from './slider-styles/useSliderEngine'
import CinematicSlide from './slider-styles/CinematicSlide'
import EmergeSlide from './slider-styles/EmergeSlide'
import StoryRailSlide from './slider-styles/StoryRailSlide'
import EditorialSplitSlide from './slider-styles/EditorialSplitSlide'
import type { SliderBlockProps } from './SliderBlock'

// Fixed-height presets. `fitContent` deliberately carries no class: an
// unconstrained ancestor makes the style component's own `h-full` resolve to
// `auto` per the CSS percentage-height spec, so the slider's height falls out
// of its content naturally instead of needing a second code path.
const HEIGHT_CLASS: Record<string, string> = {
  compact:    'h-[clamp(320px,42vh,440px)]',
  standard:   'h-[clamp(420px,58vh,620px)]',
  large:      'h-[clamp(520px,72vh,760px)]',
  fullScreen: 'h-[100svh]',
  fitContent: '',
}

// `fitContent`'s empty class relies on an unconstrained ancestor letting the
// style component's own `h-full` resolve to auto (see the comment above) —
// which in turn requires some non-absolutely-positioned descendant to supply
// real intrinsic height. Emerge's dock band splits the region into a flex
// column whose visual zone has ONLY absolutely-positioned layers, so it has
// nothing to hand up; it falls back to the Standard footprint instead of
// collapsing toward zero.
function resolveHeightClass(style: SliderBlockProps['presentationStyle'], height: SliderBlockProps['styleOptions']['height']) {
  if (style === 'emerge' && height === 'fitContent') return HEIGHT_CLASS.standard
  return HEIGHT_CLASS[height]
}

// All four Presentation Styles are implemented — see
// OT_SliderBlock-requirements.md §5 for each style's dedicated spec.
const STYLE_COMPONENT = {
  cinematic:      CinematicSlide,
  editorialSplit: EditorialSplitSlide,
  storyRail:      StoryRailSlide,
  emerge:         EmergeSlide,
} as const

export default function SliderBlockClient({ presentationStyle, slides, styleOptions }: SliderBlockProps) {
  const headlines = useMemo(() => slides.map(s => s.headline), [slides])

  const engine = useSliderEngine({
    slideCount: slides.length,
    loop:       styleOptions.loop,
    autoPlayMs: styleOptions.autoPlayMs,
    ariaLabel:  slides[0]?.headline ? `Slideshow: ${slides[0].headline}` : undefined,
    headlines,
    // Story Rail's rail-shift reads best snappier than the other styles'
    // ~700ms kinetic wipe (requirements §5.3: ~450ms) — see useSliderEngine's
    // `scrollDuration` doc for why this doesn't touch any other style.
    scrollDuration: presentationStyle === 'storyRail' ? 16 : undefined,
  })

  if (slides.length < 2) return null

  const StyleComponent = STYLE_COMPONENT[presentationStyle] ?? CinematicSlide
  const isContained = styleOptions.width === 'contained'

  return (
    // Deliberate deviation from the rest of components/blocks/, where the gap
    // below a block is always the CMS Section/Row wrapper's own Vertical
    // Spacing setting, never baked into the block. Slider is full-bleed by
    // default and reads as visually "snug" against whatever follows even with
    // Vertical Spacing set, so it carries its own fallback bottom margin on
    // every instance — accepted tradeoff: an editor who also raises the
    // section's Vertical Spacing will see the two stack.
    <div className={cn('mb-lg', isContained && 'max-w-[80rem] mx-auto px-md lg:px-lg')}>
      <div
        {...engine.regionProps}
        className={cn('relative w-full outline-none', resolveHeightClass(presentationStyle, styleOptions.height))}
      >
        {/* Manual-navigation-only announcement (WCAG carousel guidance: never
            announce autoplay ticks, only user-initiated slide changes). */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {engine.announcement}
        </div>

        <StyleComponent slides={slides} styleOptions={styleOptions} engine={engine} />

        {/* Autoplay pause control — mandatory whenever Auto-Play ≠ Off (WCAG
            2.2.2). Not rendered under reduced motion, since autoplay never
            starts there and a toggle with nothing to pause would be inert UI. */}
        {engine.showPlayToggle && (
          <button
            onClick={engine.togglePlay}
            aria-pressed={!engine.isPlaying}
            aria-label={engine.isPlaying ? 'Pause slideshow' : 'Play slideshow'}
            className="absolute z-30 bottom-md left-md flex items-center justify-center w-9 h-9 rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-sm hover:bg-black/35 transition-colors"
          >
            {engine.isPlaying ? <Pause className="w-4 h-4" strokeWidth={1.75} aria-hidden /> : <Play className="w-4 h-4" strokeWidth={1.75} aria-hidden />}
          </button>
        )}
      </div>
    </div>
  )
}
