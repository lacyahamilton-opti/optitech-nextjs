'use client'

import { Children } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSliderEngine } from '@/components/blocks/slider-styles/useSliderEngine'

const AUTOPLAY_MS: Record<string, number> = { slow: 8000, medium: 5000, fast: 3000 }

const PEEK_OUTER: Record<string, string> = {
  none: 'overflow-hidden',
  sm:   'overflow-hidden',
  md:   'overflow-hidden',
  lg:   'overflow-hidden',
}

const PEEK_INSET: Record<string, string> = {
  none: '',
  sm:   'px-[4%]',
  md:   'px-[8%]',
  lg:   'px-[14%]',
}

// Gap between slides, keyed to the row's Content Spacing dropdown. Applied as a
// per-slide gutter (half on each side) + a matching negative margin on the track
// so the outer slides still align flush with the container edge.
const GAP_VAR: Record<string, string> = {
  none:   '0px',
  small:  'var(--spacing-sm)',
  medium: 'var(--spacing-md)',
  large:  'var(--spacing-lg)',
  xl:     'var(--spacing-xl)',
}

type Props = {
  children:         ReactNode
  transition:       string
  controls:         string
  autoplay:         string
  loop:             string
  peek:             string
  gap?:             string
  verticalPadding:  string
  bgColorClass:     string
  paProps?:         Record<string, unknown>
  staggerAttr?:     string | undefined
}

export default function SliderRow({
  children,
  transition      = 'slide',
  controls        = 'both',
  autoplay        = 'off',
  loop            = 'loop',
  peek            = 'none',
  gap             = 'medium',
  verticalPadding = '',
  bgColorClass    = '',
  paProps         = {},
  staggerAttr,
}: Props) {
  const slides = Children.toArray(children)
  const count  = slides.length
  const isFadeBased = transition === 'fade' || transition === 'morph'
  const hasPeek      = peek !== 'none'
  const gapValue     = GAP_VAR[gap] ?? GAP_VAR.none
  const hasGap       = gapValue !== GAP_VAR.none

  // Same Embla-powered engine OT_SliderBlock uses — physics-based drag/swipe,
  // pause-on-hover/focus/tab-hidden autoplay, prefers-reduced-motion, and
  // keyboard arrow nav all come from here rather than being reimplemented.
  // `align: 'center'` only when peeking symmetrically on both sides is what
  // this style calls for (every SliderBlock style peeks from one side only,
  // hence that not being the hook's default).
  const engine = useSliderEngine({
    slideCount: count,
    loop:       loop as 'loop' | 'bounce' | 'none',
    autoPlayMs: autoplay === 'off' ? null : (AUTOPLAY_MS[autoplay] ?? null),
    ariaLabel:  'Carousel',
    headlines:  [],
    align:      hasPeek ? 'center' : 'start',
  })
  const { activeIndex, canPrev, canNext, goTo, next, prev, viewportRef, regionProps, reducedMotion } = engine

  const showArrows = controls === 'both' || controls === 'arrows'
  const showDots   = controls === 'both' || controls === 'dots'
  // Reduced motion still respects the transition style's identity (a fade
  // stays a fade, not a hard cut) but collapses its duration, matching every
  // other style built on this engine.
  const slideDuration = reducedMotion ? 'duration-150' : (transition === 'morph' ? 'duration-700' : 'duration-500')

  return (
    <div
      className={cn('vb:row w-full', bgColorClass, verticalPadding)}
      data-stagger={staggerAttr}
      {...regionProps}
      {...paProps}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">{engine.announcement}</div>

      {/* Track */}
      <div className={cn('relative w-full', PEEK_OUTER[peek])}>
        <div className={cn(hasPeek && PEEK_INSET[peek])}>
          {isFadeBased ? (
            // Fade / Morph: Embla still owns index/drag/loop/autoplay via an
            // invisible track (below); the visible layer is a plain absolute
            // crossfade, since Embla's own transform isn't what's on screen.
            <div className="relative">
              <div ref={viewportRef} className="absolute inset-0 overflow-hidden opacity-0 pointer-events-none" aria-hidden="true">
                <div className="flex h-full">
                  {slides.map((_, i) => <div key={i} className="flex-[0_0_100%] h-full" />)}
                </div>
              </div>
              {slides.map((slide, i) => (
                <div
                  key={i}
                  aria-hidden={i !== activeIndex}
                  className={cn(
                    'w-full',
                    'transition-[opacity,filter,transform]',
                    'ease-[var(--ease-kinetic)]',
                    slideDuration,
                    i === activeIndex
                      ? 'relative opacity-100'
                      : [
                          'absolute inset-0 pointer-events-none opacity-0',
                          transition === 'morph' && 'scale-[0.97] blur-[4px]',
                        ],
                  )}
                >
                  {slide}
                </div>
              ))}
            </div>
          ) : (
            // Slide / Cover: Embla's own track *is* the visible carousel —
            // its physics-based drag/snap directly drives what's on screen,
            // the same way Cinematic's background wipe reuses its track.
            // Unlike every SliderBlock style, real text content lives inside
            // this draggable track (SliderBlock only ever drags over images,
            // keeping text in a separate overlay) — `select-none` keeps a
            // drag gesture from starting a text selection instead.
            <div ref={viewportRef} className="overflow-hidden select-none">
              <div
                className="flex"
                style={hasGap ? { marginInline: `calc(${gapValue} / -2)` } : undefined}
              >
                {slides.map((slide, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-full shrink-0',
                      transition === 'cover' && cn(
                        'transition-[transform,opacity] ease-[var(--ease-kinetic)]',
                        slideDuration,
                        i !== activeIndex && 'scale-[0.88] opacity-40',
                      ),
                    )}
                    style={hasGap ? { paddingInline: `calc(${gapValue} / 2)` } : undefined}
                  >
                    {slide}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation bar */}
      {(showArrows || showDots) && (
        <div
          className={cn(
            'flex items-center mt-lg',
            showArrows && showDots ? 'justify-between px-1' : 'justify-center',
          )}
        >
          {showArrows && (
            <button
              onClick={prev}
              disabled={!canPrev}
              className="flex items-center justify-center w-9 h-9 rounded-full border border-fg/10 text-fg-muted hover:text-fg hover:border-fg/30 disabled:opacity-25 transition-colors"
              aria-label="Previous slide"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {showDots && (
            <div className="flex items-center gap-2" role="tablist" aria-label="Slides">
              {slides.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === activeIndex}
                  onClick={() => goTo(i)}
                  className={cn(
                    'rounded-full transition-all ease-[var(--ease-kinetic)] duration-300',
                    i === activeIndex
                      ? 'w-5 h-[6px] bg-brand'
                      : 'w-[6px] h-[6px] bg-fg/20 hover:bg-fg/40',
                  )}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}

          {showArrows && (
            <button
              onClick={next}
              disabled={!canNext}
              className="flex items-center justify-center w-9 h-9 rounded-full border border-fg/10 text-fg-muted hover:text-fg hover:border-fg/30 disabled:opacity-25 transition-colors"
              aria-label="Next slide"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
