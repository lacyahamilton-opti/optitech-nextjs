'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { RichText } from '@optimizely/cms-sdk/react/richText'
import { OT_COLOR_FILL_CLASS, OT_COLOR_VAR } from '@/lib/colorTokens'
import type { SlideData } from '@/components/blocks/SliderBlock'
import {
  type SlideStyleComponentProps,
  forcedThemeFor, textRoleClass, ctaVariant, needsLightSurface,
  headingClassForHeight, hasMediaFor, SlideVisual, SlideOverlayLayer,
  glassClassFor, glassBackdropClassFor,
} from './shared'

export type { SlideStyleComponentProps }

// ─── Editorial Split — requirements §5.2 ────────────────────────────────────
//
// Two flex panels (45% text / 55% media on desktop, stacked text-above-media
// below `md`). Content Placement picks which side is which — `center` has no
// meaning in a two-panel layout, so it falls back to `left` (documented on
// the content-type field itself, not just here).
//
// The text panel's background IS the slide's Background Color — there's no
// media behind it, so unlike every other style, its text/CTA contrast is
// computed as if `hasMedia` were always false, regardless of whether the
// *media* panel actually has an image/video. The media panel shows Video >
// Image > a deeper shade of the same Background Color (`.slider-media-fallback`
// in globals.css) so a slide with no media still reads as intentional.
//
// Transition — explicitly NOT the crossfade the spec describes: on request,
// the whole two-panel composition slides up + fades as one unit instead
// (outgoing drifts up and out while incoming rises into place from below),
// still synchronized rather than staggered — Editorial Split's two-zone
// layout already visually separates "text changed" from "image changed", so
// there's no need for Cinematic's content-lags-the-background trick here.

const CONTENT_TRANSITION_MOTION = {
  enter:  { opacity: 0, y: 72 },
  center: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
  exit:   { opacity: 0, y: -32, transition: { duration: 0.4, ease: [0.4, 0, 1, 1] as const } },
}
const CONTENT_TRANSITION_REDUCED = {
  enter:  { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit:   { opacity: 0, transition: { duration: 0.15 } },
}

// ─── Media panel ────────────────────────────────────────────────────────────

function MediaPanel({ slide, priority }: { slide: SlideData; priority: boolean }) {
  const hasMedia = hasMediaFor(slide)
  return (
    <div className="relative h-full w-full overflow-hidden">
      {hasMedia ? (
        <SlideVisual slide={slide} priority={priority} />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 slider-media-fallback"
          style={{ '--slider-tint': OT_COLOR_VAR[slide.backgroundColor] } as React.CSSProperties}
        />
      )}
      {/* Overlay only ever applies to the media panel (requirements §5.2). */}
      <SlideOverlayLayer slide={slide} />
    </div>
  )
}

// ─── Text panel ─────────────────────────────────────────────────────────────

function TextPanel({
  slide, headingLevel, verticalAlign, height, index, count, reducedMotion,
}: {
  slide: SlideData
  headingLevel: 'h1' | 'h2'
  verticalAlign: 'top' | 'center' | 'bottom'
  height: SlideStyleComponentProps['styleOptions']['height']
  index: number
  count: number
  reducedMotion: boolean
}) {
  const Heading = headingLevel
  // The text panel is always a flat color fill — never sits over media — so
  // its contrast is computed the same way BannerBlock's solid-fill path
  // would, independent of what the media panel is showing.
  const forcedTheme   = forcedThemeFor(slide.backgroundColor, false)
  const lightSurface  = needsLightSurface(slide.backgroundColor, false)
  // Frosted Panel here means an actual glass card around the content — not a
  // no-op like it would be if we just skipped it. Since the text panel is
  // always a flat fill, backdrop-filter has nothing to react to on its own,
  // so the panel's own background swaps to the same gradient-backdrop trick
  // BannerBlock's glass treatment uses for its no-image case (requirements
  // §5.2 doesn't cover this explicitly — Editorial Split's whole text panel
  // being a flat fill is exactly the scenario that trick was built for).
  const isFrosted = slide.overlay === 'frostedPanel'

  const body = slide.body ? (
    <div data-rich-text="" data-color={forcedTheme === 'dark' ? 'brand' : undefined} className={cn('text-body leading-body text-pretty max-w-[48ch]', textRoleClass('body', slide.backgroundColor, false))}>
      {typeof slide.body === 'string' ? <p>{slide.body}</p> : <RichText content={slide.body} />}
    </div>
  ) : null

  const ctas = (slide.buttonLabel && slide.buttonUrl) || (slide.secondaryLabel && slide.secondaryUrl) ? (
    <div className="flex flex-wrap items-center gap-lg mt-sm">
      {slide.buttonLabel && slide.buttonUrl && (
        <Button variant={ctaVariant(slide.backgroundColor)} href={slide.buttonUrl}>{slide.buttonLabel}</Button>
      )}
      {slide.secondaryLabel && slide.secondaryUrl && (
        <Link
          href={slide.secondaryUrl}
          className={cn('text-label font-semibold tracking-label uppercase underline underline-offset-4 decoration-1 hover:opacity-70 transition-opacity', textRoleClass('heading', slide.backgroundColor, false))}
        >
          {slide.secondaryLabel}
        </Link>
      )}
    </div>
  ) : null

  return (
    <motion.div
      key={index}
      data-theme={forcedTheme}
      data-surface={lightSurface ? 'light' : undefined}
      role="group"
      aria-roledescription="slide"
      aria-label={`Slide ${index + 1} of ${count}`}
      variants={reducedMotion ? CONTENT_TRANSITION_REDUCED : CONTENT_TRANSITION_MOTION}
      initial="enter"
      animate="center"
      exit="exit"
      className={cn(
        'relative h-full flex flex-col overflow-y-auto',
        // The glass card below carries its own padding around the text —
        // stacking the panel's full padding on top of that (as the non-
        // frosted path uses) left too little vertical room at Standard
        // height for `margin: auto 0` to actually center it, so it just
        // overflowed toward one edge instead. A much lighter outer inset
        // (just enough that the card doesn't touch the panel's own edges)
        // fixes that.
        isFrosted ? 'p-md lg:p-lg' : 'px-lg py-2xl lg:px-2xl',
        isFrosted ? glassBackdropClassFor(slide.backgroundColor) : OT_COLOR_FILL_CLASS[slide.backgroundColor],
      )}
    >
      <div
        className={cn(
          'flex flex-col shrink-0',
          // The glass card fills the panel's padded width instead of
          // capping at a reading-length measure — a narrower reading column
          // makes sense for plain text sitting directly on the flat fill,
          // but capping the card itself just left visible backdrop gutters
          // down each side of it.
          isFrosted ? 'w-full' : 'max-w-[48ch]',
          isFrosted && ['banner-glass', glassClassFor(slide.backgroundColor), 'px-lg py-lg lg:px-xl lg:py-xl'],
        )}
        // Longhand-only, always both set (never mixed with the `margin`
        // shorthand across re-renders) — React warns when a style object
        // toggles between shorthand and longhand for the same property, and
        // switching Content Vertical Alignment did exactly that here.
        style={{
          marginTop:    verticalAlign === 'top'    ? 0 : 'auto',
          marginBottom: verticalAlign === 'bottom' ? 0 : 'auto',
        }}
      >
        {slide.eyebrow && <p className={cn('text-label font-semibold tracking-label uppercase', textRoleClass('eyebrow', slide.backgroundColor, false))}>{slide.eyebrow}</p>}
        {slide.headline && <Heading className={cn(headingClassForHeight(height), 'font-extrabold text-balance mt-xs', textRoleClass('heading', slide.backgroundColor, false))}>{slide.headline}</Heading>}
        {body && <div className="mt-sm">{body}</div>}
        {ctas}
      </div>
    </motion.div>
  )
}

// ─── EditorialSplitSlide ────────────────────────────────────────────────────

export default function EditorialSplitSlide({ slides, styleOptions, engine }: SlideStyleComponentProps) {
  const { activeIndex, slideCount, canPrev, canNext, prev, next, goTo, reducedMotion, viewportRef, showPlayToggle } = engine
  const activeSlide = slides[activeIndex]
  const showArrows = styleOptions.navigation === 'both' || styleOptions.navigation === 'arrows'
  const showDots   = styleOptions.navigation === 'both' || styleOptions.navigation === 'dots'

  if (!activeSlide) return null

  // No true center in a two-panel layout — falls back to left (requirements
  // §5.2; also documented on the content type field's own description).
  const isTextRight = activeSlide.contentPlacement === 'right'
  const priority = styleOptions.headingLevel === 'h1'

  const textPanel = (
    <div className="relative h-full md:w-[45%] shrink-0">
      <TextPanel
        slide={activeSlide}
        headingLevel={styleOptions.headingLevel}
        verticalAlign={styleOptions.contentVerticalAlign}
        height={styleOptions.height}
        index={activeIndex}
        count={slideCount}
        reducedMotion={reducedMotion}
      />
      {/* Dot row — pinned to the text panel's own bottom edge regardless of
          Content Vertical Alignment, same idiom as a carousel's chrome
          staying independent of where its content sits. */}
      {showDots && slideCount > 1 && (
        <div className="absolute z-20 bottom-md inset-x-0 flex justify-center items-center gap-2" role="tablist" aria-label="Slides">
          {slides.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(
                'rounded-full transition-all duration-300',
                i === activeIndex ? 'w-6 h-1.5 bg-fg/50' : 'w-1.5 h-1.5 bg-fg/25 hover:bg-fg/40',
              )}
            />
          ))}
        </div>
      )}
    </div>
  )

  const mediaPanel = (
    <div className="relative h-full md:w-[55%] flex-1">
      <MediaPanel slide={activeSlide} priority={priority} />
    </div>
  )

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Invisible drag surface — Embla still owns index/swipe/loop/autoplay
          state here exactly as in every other style; the visible content
          below is a plain AnimatePresence swap, not Embla's translated track. */}
      <div ref={viewportRef} className="absolute inset-0 overflow-hidden opacity-0 pointer-events-none" aria-hidden="true">
        <div className="flex h-full">
          {slides.map((slide, i) => <div key={slide.key || i} className="flex-[0_0_100%] h-full" />)}
        </div>
      </div>

      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={activeIndex}
          variants={reducedMotion ? CONTENT_TRANSITION_REDUCED : CONTENT_TRANSITION_MOTION}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0 flex flex-col md:flex-row"
        >
          {isTextRight ? <>{mediaPanel}{textPanel}</> : <>{textPanel}{mediaPanel}</>}
        </motion.div>
      </AnimatePresence>

      {/* SliderBlock.client.tsx renders the mandatory autoplay pause toggle
          as a fixed white-on-dark chip in this exact corner for every style —
          safe everywhere else because that corner always has media (or a
          forced-dark background) underneath. Here it can land on the flat
          text panel instead, which is a guaranteed (not just probable, as
          with a light photo) contrast failure on Canvas/Surface — so add a
          small dark corner scrim only when that's actually the situation. */}
      {showPlayToggle && !isTextRight && (
        <div
          aria-hidden="true"
          className="absolute z-10 bottom-0 left-0 w-28 h-28 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 0% 100%, oklch(from var(--ot-canvas) 0 0 0 / 0.55), transparent 70%)' }}
        />
      )}

      {/* Arrows — bottom corners of the whole slide (not the panel seam;
          floating mid-split read as disconnected from either panel). Sized
          up from the original 36px and offset clear of the mandatory
          autoplay pause toggle, which always claims the bottom-left corner
          first. Since either corner can end up over the text panel's flat
          fill or the media panel's photo depending on Content Placement, the
          semi-opaque self-colored chip (rather than the white-on-dark chrome
          the other styles use, which assumes a dark backdrop) stays legible
          either way — same reasoning as the pause-toggle scrim above. */}
      {showArrows && slideCount > 1 && (
        <>
          <button
            onClick={prev}
            disabled={!canPrev}
            aria-label="Previous slide"
            className="absolute z-20 bottom-md left-16 flex items-center justify-center w-11 h-11 rounded-full border border-fg/15 bg-canvas/90 text-fg shadow-sm hover:bg-fg/5 disabled:opacity-25 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.75} aria-hidden />
          </button>
          <button
            onClick={next}
            disabled={!canNext}
            aria-label="Next slide"
            className="absolute z-20 bottom-md right-md flex items-center justify-center w-11 h-11 rounded-full border border-fg/15 bg-canvas/90 text-fg shadow-sm hover:bg-fg/5 disabled:opacity-25 transition-colors"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={1.75} aria-hidden />
          </button>
        </>
      )}
    </div>
  )
}
