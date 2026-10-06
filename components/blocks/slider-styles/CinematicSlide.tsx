'use client'

import Image from 'next/image'
import { AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import BannerBackgroundVideo from '@/components/blocks/BannerBackgroundVideo'
import type { SlideData } from '@/components/blocks/SliderBlock'
import {
  type SlideStyleComponentProps,
  SlideContent, SlideBackgroundFill, SlideOverlayLayer,
} from './shared'

export type { SlideStyleComponentProps }

// ─── Background layer (Embla-translated, per slide) ────────────────────────

function SlideBackground({ slide, isActive, priority }: { slide: SlideData; isActive: boolean; priority: boolean }) {
  const hasImage = Boolean(slide.backgroundImageSrc)
  const hasVideo = Boolean(slide.backgroundVideoSrc)

  if (isActive && hasVideo) {
    return (
      <BannerBackgroundVideo
        src={slide.backgroundVideoSrc!}
        poster={slide.backgroundImageSrc}
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    )
  }
  if (hasImage) {
    return (
      <Image
        src={slide.backgroundImageSrc!}
        alt=""
        fill
        sizes="100vw"
        priority={priority}
        quality={85}
        className="object-cover object-center"
      />
    )
  }
  return <SlideBackgroundFill slide={slide} />
}

// ─── Content layer (independent of the background's horizontal wipe — fades
// and lifts in place, on its own beat). Rendering itself (placement/alignment,
// eyebrow/heading/body/CTAs, frosted-panel treatment) lives in shared.tsx's
// `SlideContent`, reused by Emerge too — only this timing differs per style. ─

const CONTENT_TRANSITION_MOTION = {
  enter:  { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.35, ease: [0.65, 0, 0.35, 1] as const } },
  exit:   { opacity: 0, y: -8, transition: { duration: 0.25, ease: [0.65, 0, 0.35, 1] as const } },
}

// ─── CinematicSlide ─────────────────────────────────────────────────────────

export default function CinematicSlide({ slides, styleOptions, engine }: SlideStyleComponentProps) {
  const { activeIndex, slideCount, canPrev, canNext, prev, next, goTo, progressKey, showPlayToggle, reducedMotion, viewportRef } = engine
  const activeSlide = slides[activeIndex]
  const showArrows = styleOptions.navigation === 'both' || styleOptions.navigation === 'arrows'
  const showDots   = styleOptions.navigation === 'both' || styleOptions.navigation === 'dots'
  const showAutoplayDots = showDots && styleOptions.autoPlayMs !== null

  if (!activeSlide) return null

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Background layer — Embla owns the drag/swipe + snap physics here;
          the incoming slide's natural adjacent position IS the edge wipe. */}
      <div ref={viewportRef} className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="flex h-full">
          {slides.map((slide, i) => (
            <div key={slide.key || i} className="relative flex-[0_0_100%] h-full">
              <SlideBackground slide={slide} isActive={i === activeIndex} priority={styleOptions.headingLevel === 'h1' && i === 0} />
              <SlideOverlayLayer slide={slide} />
            </div>
          ))}
        </div>
      </div>

      {/* Content layer — independent fade/lift, lagging the background wipe */}
      <div className="relative z-10 h-full flex items-center py-xl">
        <AnimatePresence mode="sync" initial={false}>
          <SlideContent
            key={activeIndex}
            slide={activeSlide}
            headingLevel={styleOptions.headingLevel}
            verticalAlign={styleOptions.contentVerticalAlign}
            height={styleOptions.height}
            index={activeIndex}
            count={slideCount}
            reducedMotion={reducedMotion}
            variants={CONTENT_TRANSITION_MOTION}
          />
        </AnimatePresence>
      </div>

      {/* Arrows — pinned to the far edges, vertically centered. Cinematic's
          content is also vertically centered and, unlike the other three
          styles (which keep their nav clear by anchoring to the bottom),
          isn't capped away from the edges below `lg`, so a centered arrow
          sits right on top of the headline/body at phone widths. Embla's
          `watchDrag` already gives touch/mouse drag at every width, and the
          dot row below is bottom-anchored and never collides — so below
          `lg` this hides the arrows and leans on swipe + dots instead of
          reserving gutter space that would fight the frosted-panel/left/right
          placements for room. */}
      {showArrows && slideCount > 1 && (
        <>
          <button
            onClick={prev}
            disabled={!canPrev}
            aria-label="Previous slide"
            className="hidden lg:flex absolute z-20 left-md top-1/2 -translate-y-1/2 items-center justify-center w-11 h-11 rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-sm hover:bg-black/35 disabled:opacity-25 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.75} aria-hidden />
          </button>
          <button
            onClick={next}
            disabled={!canNext}
            aria-label="Next slide"
            className="hidden lg:flex absolute z-20 right-md top-1/2 -translate-y-1/2 items-center justify-center w-11 h-11 rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-sm hover:bg-black/35 disabled:opacity-25 transition-colors"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={1.75} aria-hidden />
          </button>
        </>
      )}

      {/* Pagination — dot row, or progress-fill bars when Auto-Play is on */}
      {showDots && slideCount > 1 && (
        <div
          className={cn('absolute z-20 bottom-md left-1/2 -translate-x-1/2 flex items-center gap-2', showPlayToggle && 'right-md left-auto translate-x-0 bottom-md')}
          role="tablist"
          aria-label="Slides"
        >
          {slides.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(
                'relative overflow-hidden rounded-full bg-white/30 transition-all duration-300',
                i === activeIndex ? 'w-6 h-1.5 bg-white/40' : 'w-1.5 h-1.5 hover:bg-white/50',
              )}
            >
              {showAutoplayDots && i === activeIndex && (
                <span
                  key={progressKey}
                  className="slider-dot-progress bg-white"
                  style={{ '--slider-dot-dur': `${styleOptions.autoPlayMs}ms` } as React.CSSProperties}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
