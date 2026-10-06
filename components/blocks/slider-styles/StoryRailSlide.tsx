'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useAnimation } from 'framer-motion'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SlideData } from '@/components/blocks/SliderBlock'
import {
  type SlideStyleComponentProps,
  forcedThemeFor, textRoleClass, hasMediaFor, glassClassFor,
  SlideVisual, SlideOverlayLayer, resolveRadiusPx,
} from './shared'

export type { SlideStyleComponentProps }

// ─── Story Rail — requirements §5.3 ─────────────────────────────────────────
//
// A horizontal card rail: one fully-visible active card, one adjacent card
// peeking in from the right, further cards cropped at the viewport edge.
// Content Placement / Content Vertical Alignment are ignored — every card
// uses the same fixed anchor (eyebrow pill top-left, headline+meta+CTA
// bottom-left). Unlike Cinematic/Emerge, ALL slides are simultaneously
// present in the DOM here (it's a real scroller, not a single active-content
// swap) — see the per-card `isActive` handling below for what that means for
// focus order and heading semantics.
//
// The rail shift itself is just Embla's own translateX — the same "let the
// engine's natural motion be the transition" idiom Cinematic uses for its
// background wipe. Two flourishes layer on top, both skipped under reduced
// motion, both designed to read as one smooth "blend" rather than a hard cut:
//   1. A blur ramp (0 → ~7px → 0 over the shift) on the whole track, via a
//      Framer Motion keyframe array independent of Embla's own transform
//      easing (requirements §5.3).
//   2. The outgoing card's text cluster fades and slides out in the direction
//      of travel (it visibly detaches and races ahead of its own image),
//      while the incoming card's cluster fades + slides in from the opposite
//      edge on a short delay, so content settles a beat after the image does
//      — the same "content lags the wipe" idiom Cinematic uses. Only the two
//      cards actually involved in a given transition animate; every other
//      card's content stays exactly as it was.

const SHIFT_MS  = 450
const BLUR_PEAK = 7

// Active card width / peek proportion — fixed constants of this style, not
// display settings (requirements §5.3). Mobile carries a smaller peek so the
// active card still reads as dominant; desktop's peek is more generous.
const CARD_BASIS = 'flex-[0_0_88%] lg:flex-[0_0_78%]'
const GUTTER_POSITION = 'left-[88%] lg:left-[78%]'

const CONTENT_EXIT_MS  = 400
const CONTENT_ENTER_MS = 500
const CONTENT_ENTER_DELAY_MS = 120
const CONTENT_OFFSET_PX = 56
const CONTENT_TRANSITION_MS = CONTENT_ENTER_DELAY_MS + CONTENT_ENTER_MS + 100

// Plain-text first line of Body, for the small meta/kicker line under the
// headline (requirements §5.3: "don't render full rich text here"). Body may
// be a Slate-style JSON tree (array of block nodes) or a plain string.
function firstPlainLine(body: SlideData['body']): string | null {
  if (!body) return null
  if (typeof body === 'string') return body.trim() || null
  const nodes = body as unknown as Array<{ text?: string; children?: unknown[] }>
  const first = Array.isArray(nodes) ? nodes[0] : null
  if (!first) return null
  function collect(node: { text?: string; children?: unknown[] } | undefined): string {
    if (!node) return ''
    if (typeof node.text === 'string') return node.text
    if (Array.isArray(node.children)) return (node.children as typeof nodes).map(collect).join('')
    return ''
  }
  const text = collect(first).trim()
  return text || null
}

type ContentPhase = 'idle' | 'exiting' | 'entering'

// ─── Card ───────────────────────────────────────────────────────────────────

function RailCard({
  slide, index, count, isActive, headingLevel, radiusPx, priority, phase, forward, runId,
}: {
  slide: SlideData
  index: number
  count: number
  isActive: boolean
  headingLevel: 'h1' | 'h2'
  radiusPx: number
  priority: boolean
  /** 'idle' for every card not currently part of a transition — only the
   *  outgoing and incoming card ever get 'exiting'/'entering' for the ~500ms
   *  around a slide change. */
  phase: ContentPhase
  /** Direction of the transition this card is (or was) part of — irrelevant when phase is 'idle'. */
  forward: boolean
  runId: number
}) {
  const hasMedia = hasMediaFor(slide)
  const forcedTheme = forcedThemeFor(slide.backgroundColor, hasMedia)
  const isFrosted = slide.overlay === 'frostedPanel'
  const shadowClass = hasMedia && !isFrosted ? 'slider-text-shadow' : undefined
  const meta = firstPlainLine(slide.body)
  // Only the active card honors the block's headingLevel — Story Rail keeps
  // every other slide's headline in the DOM simultaneously (it's a real
  // scroller, not a single active-content swap), and this is explicitly not
  // a "hero" style (requirements §5.3), so duplicating an h1 across peeking
  // cards would be worse than just using h3 for the rest.
  const Heading = isActive ? headingLevel : 'h3'

  const clusterClassName = cn(
    'absolute z-10 left-sm right-sm bottom-16 lg:left-md lg:right-md lg:bottom-20 flex flex-col gap-xs lg:gap-sm',
    isFrosted && ['banner-glass', glassClassFor(slide.backgroundColor), 'p-sm lg:p-md'],
  )
  const clusterStyle = isFrosted ? { borderRadius: radiusPx } : undefined

  const clusterInner = (
    <>
      {slide.headline && (
        <Heading className={cn('text-[clamp(1.5rem,2.6vw,2.25rem)] leading-headline tracking-headline font-bold text-balance line-clamp-2', textRoleClass('heading', slide.backgroundColor, hasMedia), !isFrosted && shadowClass)}>
          {slide.headline}
        </Heading>
      )}
      {meta && (
        <p className={cn('text-body leading-snug line-clamp-1', textRoleClass('body', slide.backgroundColor, hasMedia), !isFrosted && shadowClass)}>
          {meta}
        </p>
      )}
      {slide.buttonLabel && slide.buttonUrl && (
        <Link
          href={slide.buttonUrl}
          tabIndex={isActive ? 0 : -1}
          className={cn('group inline-flex w-fit items-center gap-1 text-label font-semibold tracking-label uppercase hover:opacity-80 transition-opacity', textRoleClass('heading', slide.backgroundColor, hasMedia), !isFrosted && shadowClass)}
        >
          {slide.buttonLabel}
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
        </Link>
      )}
    </>
  )

  // A signed pixel offset, not a Tailwind class, since the same "exit/enter"
  // motion mirrors depending on which way the rail is moving.
  const dir = forward ? 1 : -1

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`Slide ${index + 1} of ${count}`}
      data-theme={forcedTheme}
      className="relative h-full overflow-hidden shadow-hover-lift ring-1 ring-white/10"
      style={{ borderRadius: radiusPx }}
    >
      <SlideVisual slide={slide} priority={priority} active={isActive} />
      <SlideOverlayLayer slide={slide} />

      {/* Belt-and-suspenders legibility for the bottom-left text cluster,
          independent of whichever Overlay the editor picked (recommended but
          not required to be Bottom Fade / Even Tint — requirements §5.3).
          Skipped under Frosted Panel, whose glass backdrop covers this job. */}
      {hasMedia && !isFrosted && (
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />
      )}

      {slide.eyebrow && (
        <span className="absolute z-10 top-sm left-sm lg:top-md lg:left-md inline-flex items-center rounded-full bg-brand px-sm py-1 text-label font-semibold tracking-label uppercase text-fg-on-brand">
          {slide.eyebrow}
        </span>
      )}

      {phase === 'exiting' && (
        <motion.div
          key={`exit-${runId}`}
          initial={{ opacity: 1, x: 0 }}
          animate={{ opacity: 0, x: -CONTENT_OFFSET_PX * dir }}
          transition={{ duration: CONTENT_EXIT_MS / 1000, ease: [0.4, 0, 1, 1] }}
          className={clusterClassName}
          style={clusterStyle}
        >
          {clusterInner}
        </motion.div>
      )}
      {phase === 'entering' && (
        <motion.div
          key={`enter-${runId}`}
          initial={{ opacity: 0, x: CONTENT_OFFSET_PX * dir }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: CONTENT_ENTER_MS / 1000, delay: CONTENT_ENTER_DELAY_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
          className={clusterClassName}
          style={clusterStyle}
        >
          {clusterInner}
        </motion.div>
      )}
      {phase === 'idle' && (
        <div className={clusterClassName} style={clusterStyle}>
          {clusterInner}
        </div>
      )}
    </div>
  )
}

// ─── StoryRailSlide ─────────────────────────────────────────────────────────

export default function StoryRailSlide({ slides, styleOptions, engine }: SlideStyleComponentProps) {
  const { activeIndex, slideCount, canNext, next, prev, reducedMotion, viewportRef } = engine
  const controls = useAnimation()
  const prevActiveRef = useRef(activeIndex)
  const timersRef = useRef<number[]>([])
  const transitionRunIdRef = useRef(0)

  const [radiusPx] = useState(() => resolveRadiusPx('--ot-radius-surface', 20))
  const [transition, setTransition] = useState<{ exitingIndex: number; enteringIndex: number; forward: boolean; runId: number } | null>(null)

  function clearTimers() {
    timersRef.current.forEach(id => clearTimeout(id))
    timersRef.current = []
  }
  useEffect(() => () => clearTimers(), [])

  useEffect(() => {
    if (prevActiveRef.current === activeIndex) return
    const prevIndex = prevActiveRef.current
    prevActiveRef.current = activeIndex
    clearTimers()
    if (reducedMotion) return

    controls.start({
      filter: ['blur(0px)', `blur(${BLUR_PEAK}px)`, 'blur(0px)'],
      transition: { duration: SHIFT_MS / 1000, times: [0, 0.5, 1], ease: 'easeInOut' },
    })

    const forward = (prevIndex + 1) % slideCount === activeIndex
    const runId = ++transitionRunIdRef.current
    setTransition({ exitingIndex: prevIndex, enteringIndex: activeIndex, forward, runId })
    timersRef.current.push(window.setTimeout(() => {
      setTransition(t => (t?.runId === runId ? null : t))
    }, CONTENT_TRANSITION_MS))
  }, [activeIndex, slideCount, reducedMotion, controls])

  const navOn = styleOptions.navigation !== 'none'
  // requirements §5.3: `arrows`/`dots`/`both` all collapse to "show the
  // gutter control" — Story Rail has no separate dot-row concept.
  const showBack = navOn && activeIndex > 0

  return (
    <div className="relative h-full w-full overflow-hidden">
      <motion.div animate={controls} initial={false} className="absolute inset-0" style={{ willChange: 'filter' }}>
        <div ref={viewportRef} className="h-full w-full overflow-hidden">
          {/* The gap between cards is padding-left on each slide + a matching
              negative margin here, not CSS `gap` on this flex container.
              Confirmed live: with `gap`, Embla's loop wrap-point collapses to
              0px — its loop math positions each slide from its own measured
              width alone, and `gap` is the parent's layout property, not
              part of any single slide's box, so the wrap seam (last slide
              back to first) never got it. Padding is part of the slide's own
              measured rect, so Embla's loop math picks it up automatically,
              including at the seam. */}
          <div className="flex h-full -ml-sm lg:-ml-md">
            {slides.map((slide, i) => (
              <div key={slide.key || i} className={cn(CARD_BASIS, 'h-full pl-sm lg:pl-md')}>
                <RailCard
                  slide={slide}
                  index={i}
                  count={slideCount}
                  isActive={i === activeIndex}
                  headingLevel={styleOptions.headingLevel}
                  radiusPx={radiusPx}
                  priority={styleOptions.headingLevel === 'h1' && i === 0}
                  phase={
                    transition == null ? 'idle'
                    : i === transition.exitingIndex ? 'exiting'
                    : i === transition.enteringIndex ? 'entering'
                    : 'idle'
                  }
                  forward={transition?.forward ?? true}
                  runId={transition?.runId ?? 0}
                />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* A quieter "back" affordance once the visitor has moved past the
          first card (requirements §5.3 flags this as an open implementation
          call) — swipe/keyboard Left already work regardless. Hidden below
          `lg`: it's vertically centered over the card, and at Compact height
          (or any short card) that lands right on top of the bottom-anchored
          text cluster — since it's already just a "quieter" extra and Embla's
          drag/swipe covers going back at every width, this leans on that
          instead of fighting the cluster for room on phones. */}
      {showBack && (
        <button
          onClick={prev}
          aria-label="Previous slide"
          className="hidden lg:flex absolute z-30 left-sm top-1/2 -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full border border-white/20 bg-black/15 text-white opacity-70 backdrop-blur-sm hover:opacity-100 hover:bg-black/30 transition-all"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden />
        </button>
      )}

      {/* The single "next" gutter control — straddles the seam between the
          active card and the peeking next card, always pointing forward
          (requirements §5.3: no separate prev arrow in the gutter). */}
      {navOn && slideCount > 1 && (
        <button
          onClick={next}
          disabled={!canNext}
          aria-label="Next slide"
          className={cn('absolute z-30 top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-brand text-fg-on-brand shadow-hover-lift hover:opacity-90 disabled:opacity-30 transition-opacity', GUTTER_POSITION)}
        >
          <ChevronRight className="w-6 h-6" strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  )
}
