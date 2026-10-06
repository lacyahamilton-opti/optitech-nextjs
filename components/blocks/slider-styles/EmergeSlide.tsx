'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type SlideStyleComponentProps,
  SlideContent, SlideVisual, SlideOverlayLayer,
} from './shared'

export type { SlideStyleComponentProps }

// ─── Emerge ──────────────────────────────────────────────────────────────────
//
// A dark nav "dock" sits below the hero visual — vertical prev/next chevrons
// and a slide counter on the left, then one clickable card per slide
// (headline + eyebrow) divided by hairlines. The dock's height is carved out
// of the block's own Height budget (SliderBlock.client.tsx's
// `resolveHeightClass` falls Fit Content back to Standard here, since this
// style's visual zone has no in-flow content of its own to size against).
// The hero visual above the dock never carries its own arrows/dots — the
// dock fully replaces them.
//
// The signature move is the reveal: advancing to any slide — forward,
// backward, via a card, or an autoplay tick, always identically — uncovers
// the incoming slide's background from the bottom edge upward, matching the
// style's own name. `--reveal` (0%→100%, animated on `.emerge-reveal-mask` in
// globals.css) drives both the hard cut and its soft feather off one value,
// so nothing needs to stay measured/synced. There's no "resting preview" of
// a single fixed "next" slide the way a directional peek panel would need —
// once any card can jump to any index there's no well-defined "next" to keep
// previewing, so the reveal layer only exists for the ~900ms a transition is
// actually in flight.
//
// Content (headline/body/CTAs — shared.tsx's `SlideContent`, the same
// placement/alignment-aware block Cinematic uses) hides the instant a
// transition starts, for the whole sweep, and rises back in on its own beat
// shortly after the reveal completes — reads as one continuous "emerging"
// motion rather than a background cut plus an unrelated content swap.

const REVEAL_MS = 900
const REVEAL_EASE = [0.22, 1, 0.36, 1] as const
const CONTENT_GAP_MS = 90

const CONTENT_VARIANTS = {
  enter:  { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0, transition: { duration: 0.4, ease: REVEAL_EASE } },
  exit:   { opacity: 0, transition: { duration: 0.12 } },
}

export default function EmergeSlide({ slides, styleOptions, engine }: SlideStyleComponentProps) {
  const { activeIndex, slideCount, canPrev, canNext, prev, next, goTo, showPlayToggle, reducedMotion, viewportRef } = engine
  const prevActiveRef = useRef(activeIndex)
  const timersRef = useRef<number[]>([])

  const [bgIndex, setBgIndex]         = useState(activeIndex)
  const [revealIndex, setRevealIndex] = useState<number | null>(null)
  const [contentIndex, setContentIndex] = useState(activeIndex)
  const [contentShown, setContentShown] = useState(true)

  function clearTimers() {
    timersRef.current.forEach(id => clearTimeout(id))
    timersRef.current = []
  }
  function schedule(fn: () => void, ms: number) {
    timersRef.current.push(window.setTimeout(fn, ms))
  }
  useEffect(() => () => clearTimers(), [])

  function handleRevealComplete(index: number) {
    setBgIndex(index)
    setRevealIndex(null)
    schedule(() => {
      setContentIndex(index)
      setContentShown(true)
    }, CONTENT_GAP_MS)
  }

  useEffect(() => {
    const prevIndex = prevActiveRef.current
    prevActiveRef.current = activeIndex
    if (prevIndex === activeIndex) return
    clearTimers()

    if (reducedMotion) {
      setRevealIndex(null)
      setBgIndex(activeIndex)
      setContentIndex(activeIndex)
      setContentShown(true)
      return
    }

    // Hide content for the whole sweep, not just its tail, then kick off the
    // reveal toward whichever index we just navigated to — forward, backward,
    // or a direct card jump, all identically (see header comment).
    setContentShown(false)
    setRevealIndex(activeIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

  const bgSlide      = slides[bgIndex]
  const contentSlide = slides[contentIndex]
  if (!bgSlide || !contentSlide) return null

  const arrowsOn         = styleOptions.navigation === 'both' || styleOptions.navigation === 'arrows'
  // Requirements parity with the rest of this style family: Navigation
  // `none` keeps the dock visible (it's core chrome, not just a control) but
  // makes the cards non-interactive — swipe/keyboard remain the only advance.
  const cardsInteractive = styleOptions.navigation !== 'none'

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden">
      {/* Hero visual zone */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Invisible drag surface — Embla still owns index/swipe/loop/autoplay
            state here exactly as in every other style; Emerge just doesn't use
            its translated track as the visible background. */}
        <div ref={viewportRef} className="absolute inset-0 overflow-hidden opacity-0" aria-hidden="true">
          <div className="flex h-full">
            {slides.map((slide, i) => <div key={slide.key || i} className="relative flex-[0_0_100%] h-full" />)}
          </div>
        </div>

        {/* Real background — swapped only once the reveal fully covers the
            frame, so the swap itself is never visible. */}
        <div className="absolute inset-0" aria-hidden="true">
          <SlideVisual slide={bgSlide} priority={styleOptions.headingLevel === 'h1' && bgIndex === 0} />
          <SlideOverlayLayer slide={bgSlide} />
        </div>

        {/* Reveal layer — mounted only while a transition is in flight. */}
        {revealIndex !== null && (
          <motion.div
            key={`reveal-${revealIndex}`}
            className="absolute inset-0 emerge-reveal-mask"
            style={{ '--reveal': '0%' } as React.CSSProperties}
            animate={{ '--reveal': '100%' } as Record<string, string>}
            transition={{ duration: REVEAL_MS / 1000, ease: REVEAL_EASE }}
            onAnimationComplete={() => handleRevealComplete(revealIndex)}
            aria-hidden="true"
          >
            <SlideVisual slide={slides[revealIndex]} />
            <SlideOverlayLayer slide={slides[revealIndex]} />
            {/* Boundary glow — reads the same `--reveal` value the mask
                itself does, so it rides the moving edge for free with no
                separate measurement or sync. */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 h-6 pointer-events-none"
              style={{
                bottom: 'var(--reveal)',
                transform: 'translateY(50%)',
                background: 'linear-gradient(to top, oklch(from var(--ot-brand) l c h / 0.35), transparent)',
              }}
            />
          </motion.div>
        )}

        {/* Content — same placement/alignment-aware block Cinematic uses. */}
        <div className="relative z-10 h-full flex items-center py-lg lg:py-xl">
          <AnimatePresence mode="wait" initial={false}>
            {contentShown && (
              <SlideContent
                key={contentIndex}
                slide={contentSlide}
                headingLevel={styleOptions.headingLevel}
                verticalAlign={styleOptions.contentVerticalAlign}
                height={styleOptions.height}
                index={contentIndex}
                count={slideCount}
                reducedMotion={reducedMotion}
                variants={CONTENT_VARIANTS}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Dock — a component panel (`bg-surface`, not `bg-canvas`: this is
          chrome sitting ON the page, not the page ground itself), following
          the ambient page theme rather than forcing dark, so it reads as a
          light panel in light mode instead of a jarring black bar. */}
      <div className="relative z-10 shrink-0 h-20 lg:h-24 flex bg-surface border-t border-fg/10">
        {/* The shared autoplay toggle chip (SliderBlock.client.tsx) is
            hardcoded white-on-black — correct everywhere else, where it
            always floats over media that's now guaranteed dark (see
            SlideOverlayLayer). Here it floats over this theme-adaptive panel
            instead, which is light in light mode — so, same idiom
            EditorialSplitSlide uses for its own unpredictable corner, force
            just that corner dark behind it rather than reworking the shared
            chip's colors (which every *other* style still depends on). */}
        {showPlayToggle && (
          <div
            aria-hidden="true"
            className="absolute z-0 bottom-md left-md w-9 h-9 rounded-full pointer-events-none"
            style={{ background: 'oklch(from var(--ot-fg) 0 0 0 / 0.7)' }}
          />
        )}

        {/* Chevrons + counter. `showPlayToggle` reserves a left gutter so the
            shared toggle chip — anchored bottom-md/left-md of the whole
            region, which now lands in this corner — doesn't overlap the
            chevrons. */}
        <div className={cn('relative z-10 shrink-0 flex items-center gap-sm lg:gap-md px-sm lg:px-md', showPlayToggle && 'pl-14 lg:pl-16')}>
          {arrowsOn && slideCount > 1 && (
            <div className="flex flex-col gap-0.5">
              <button
                onClick={prev}
                disabled={!canPrev}
                aria-label="Previous slide"
                className="flex items-center justify-center w-7 h-7 rounded-full text-fg-muted hover:text-fg disabled:opacity-30 transition-colors"
              >
                <ChevronUp className="w-4 h-4" strokeWidth={1.75} aria-hidden />
              </button>
              <button
                onClick={next}
                disabled={!canNext}
                aria-label="Next slide"
                className="flex items-center justify-center w-7 h-7 rounded-full text-fg-muted hover:text-fg disabled:opacity-30 transition-colors"
              >
                <ChevronDown className="w-4 h-4" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          )}
          <span className="text-label font-semibold tabular-nums text-fg-muted" aria-hidden="true">
            {String(activeIndex + 1).padStart(2, '0')} / {String(slideCount).padStart(2, '0')}
          </span>
        </div>

        {/* Card row — one clickable card per slide. `flex-1` + a min-width
            divides the row evenly at low slide counts; once min-widths
            exceed the row's width (toward the 8-slide ceiling) it degrades
            to horizontal scroll, with no runtime measurement either way. */}
        <div className="flex-1 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {slides.map((slide, i) => {
            const isActive = i === activeIndex
            return (
              <button
                key={slide.key || i}
                type="button"
                onClick={() => goTo(i)}
                disabled={!cardsInteractive}
                tabIndex={cardsInteractive ? 0 : -1}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`Go to slide ${i + 1}${slide.headline ? `: ${slide.headline}` : ''}`}
                className={cn(
                  'relative flex-1 min-w-30 lg:min-w-40 shrink-0 text-left px-sm lg:px-md py-sm lg:py-md',
                  'border-l border-fg/10 first:border-l-0 transition-colors',
                  isActive ? 'bg-fg/6 shadow-hover-lift' : 'card-hover-lift hover:bg-fg/4',
                  !cardsInteractive && 'cursor-default',
                )}
              >
                {isActive && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand" />}
                {slide.headline && <p className="text-body font-semibold text-fg line-clamp-1">{slide.headline}</p>}
                {slide.eyebrow && (
                  <p className="mt-0.5 text-label font-semibold tracking-label uppercase emerge-card-eyebrow line-clamp-1">
                    {slide.eyebrow}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
