import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { RichText } from '@optimizely/cms-sdk/react/richText'
import { OT_COLOR_FILL_CLASS, OT_COLOR_VAR } from '@/lib/colorTokens'
import BannerBackgroundVideo from '@/components/blocks/BannerBackgroundVideo'
import type { SlideData, SlideColor, SlideOverlay } from '@/components/blocks/SliderBlock'
import type { SliderStyleOptions } from '@/cms/styling/OT_SliderBlock.styling'
import type { SliderEngine } from './useSliderEngine'

export type SlideStyleComponentProps = {
  slides:       SlideData[]
  styleOptions: SliderStyleOptions
  engine:       SliderEngine
}

// ─── Color-role helpers (mirrors BannerBlock's canvas/surface/brand/brandDeep/
// accent → theme + text-role mapping, so a media-backed slide always resolves
// to a legible forced theme regardless of the ambient page theme). Shared by
// every presentation style — see OT_SliderBlock-requirements.md §8's "every
// Background Color / Overlay combination renders with legible text" bar. ────

export function forcedThemeFor(color: SlideColor, hasMedia: boolean): 'dark' | 'light' | undefined {
  if (hasMedia) return 'dark'
  if (color === 'brand' || color === 'brandDeep') return 'dark'
  if (color === 'accent') return 'light'
  return undefined
}

export function textRoleClass(role: 'eyebrow' | 'heading' | 'body', color: SlideColor, hasMedia: boolean): string {
  // Over a photo/video, always use the neutral light-on-dark role (the same
  // one canvas/surface already resolve to under the forced data-theme="dark"
  // from forcedThemeFor) regardless of Background Color. Background Color's
  // fixed on-brand/on-accent text mapping is tuned for a SOLID fill; carrying
  // it onto an arbitrary photo risks landing dark text on a dark region of
  // the image with no guaranteed contrast, independent of which overlay is
  // chosen.
  if (hasMedia) {
    if (role === 'eyebrow') return 'text-accent'
    if (role === 'heading') return 'text-fg'
    return 'text-fg-muted'
  }
  const isBrandFamily = color === 'brand' || color === 'brandDeep'
  const isAccent      = color === 'accent'
  if (role === 'eyebrow') return isBrandFamily ? 'text-fg-on-brand/85' : isAccent ? 'text-fg-on-accent/85' : 'text-accent'
  if (role === 'heading') return isBrandFamily ? 'text-fg-on-brand'    : isAccent ? 'text-fg-on-accent'    : 'text-fg'
  return                         isBrandFamily ? 'text-fg-on-brand/80' : isAccent ? 'text-fg-on-accent/80' : 'text-fg-muted'
}

export function ctaVariant(color: SlideColor): 'brand' | 'ghost' {
  return color === 'canvas' || color === 'surface' ? 'brand' : 'ghost'
}

// Accent's solid fill (no media) is the one case where a ghost CTA needs to
// flip to a dark surface: Button's ghost variant defaults to a light fg/border
// (tuned for sitting on brand/media dark grounds) and only reads dark from
// `data-surface="light"`, a separate signal from `data-theme` (see Button.tsx
// / globals.css [data-surface="light"]).
export function needsLightSurface(color: SlideColor, hasMedia: boolean): boolean {
  return !hasMedia && color === 'accent'
}

// Headline scale follows the block's Height setting — a Compact slider reads
// awkwardly with hero-scale type, and a Full Screen one looks under-filled at
// Standard size. Mirrors how BannerBlock's headingCva keys size off its own
// `size` display setting; only the headline scales (eyebrow/body stay at
// their fixed label/body tokens, same as Banner).
export function headingClassForHeight(height: SliderStyleOptions['height']): string {
  switch (height) {
    case 'compact':    return 'text-headline leading-headline tracking-headline'
    case 'large':      return 'text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[1.05] tracking-headline'
    case 'fullScreen': return 'text-display leading-display-safe tracking-display'
    default:           return 'text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.08] tracking-headline' // standard, fitContent
  }
}

// The content column's cap widens in step with the headline scale above —
// otherwise a wider heading at Large/Full Screen wraps hard against a column
// sized for Standard's smaller type.
export function contentMaxWidthClass(height: SliderStyleOptions['height']): string {
  switch (height) {
    case 'compact':    return 'max-w-[34rem]'
    case 'large':      return 'max-w-[52rem]'
    case 'fullScreen': return 'max-w-[62rem]'
    default:           return 'max-w-[43rem]' // standard, fitContent
  }
}

export const OVERLAY_CLASS: Partial<Record<SlideOverlay, string>> = {
  evenTint:   'slider-overlay-evenTint',
  leftFade:   'slider-overlay-leftFade',
  rightFade:  'slider-overlay-rightFade',
  bottomFade: 'slider-overlay-bottomFade',
  brandWash:  'slider-overlay-brandWash',
}

export function hasMediaFor(slide: SlideData): boolean {
  return Boolean(slide.backgroundImageSrc || slide.backgroundVideoSrc)
}

// The `.banner-glass*` frosted-panel treatment (globals.css) is keyed by
// Background Color the same way everywhere it's used — extracted once so the
// "Frosted Panel" overlay choice looks identical across every style that
// offers it, rather than re-deriving the color→variant mapping per style.
export function glassClassFor(color: SlideColor): string {
  switch (color) {
    case 'brand':     return 'banner-glass-brand'
    case 'brandDeep': return 'banner-glass-brandDeep'
    case 'accent':    return 'banner-glass-accent'
    case 'surface':   return 'banner-glass-surface'
    default:          return ''
  }
}

// `backdrop-filter` is invisible against a perfectly flat color — these
// gradient backdrops (globals.css, "No-image glass backdrops") give the blur
// something to react to, exactly like BannerBlock's `getScrimClass` does for
// its own no-image glass treatment. Editorial Split's text panel is *always*
// a flat fill (never sits over media), so it needs this every time Frosted
// Panel is picked, not just in a no-media fallback case.
export function glassBackdropClassFor(color: SlideColor): string {
  switch (color) {
    case 'brand':     return 'banner-bg-brand-glass'
    case 'brandDeep': return 'banner-bg-brandDeep-glass'
    case 'accent':    return 'banner-bg-accent-glass'
    case 'surface':   return 'banner-bg-surface-glass'
    default:          return 'banner-bg-canvas-glass'
  }
}

// ─── Background layer (full-bleed image/video/color fill — identical across
// Cinematic and Emerge, both of which use a plain full-bleed background). ──

export function SlideBackgroundFill({ slide }: { slide: SlideData }) {
  return <div className={cn('absolute inset-0', OT_COLOR_FILL_CLASS[slide.backgroundColor])} />
}

export function SlideOverlayLayer({ slide }: { slide: SlideData }) {
  if (!hasMediaFor(slide) || slide.overlay === 'none' || slide.overlay === 'frostedPanel') return null
  const cls = OVERLAY_CLASS[slide.overlay]
  if (!cls) return null
  return (
    <div
      aria-hidden="true"
      // Forced dark (independent of the ambient page theme, mirroring
      // `forcedThemeFor`'s own hasMedia → dark rule) so Canvas/Surface — the
      // two color tokens that flip to near-white in light mode — still read
      // as a darkening tint over the image instead of a near-invisible white
      // wash. Brand/Brand Deep/Accent are unaffected: those tokens don't
      // change between themes.
      data-theme="dark"
      className={cn('absolute inset-0', cls)}
      style={{ '--slider-tint': OT_COLOR_VAR[slide.backgroundColor] } as React.CSSProperties}
    />
  )
}

// Image / video / color-fill renderer, identical wherever a style needs to
// paint a slide's raw background — full resolution, same `sizes` hint, same
// fallback order (video > image > solid fill) every time it's used, so
// Emerge's peek panel and Story Rail's cards never drift from Cinematic's own
// background rendering.
//
// `active` (default true) gates video playback — a style like Story Rail that
// keeps every slide simultaneously in the DOM (not just the current one)
// needs its non-active cards to fall back to the poster image instead of
// actually running N videos at once; mirrors CinematicSlide's own
// `isActive && hasVideo` check on its background track.
export function SlideVisual({ slide, priority, active = true }: { slide: SlideData; priority?: boolean; active?: boolean }) {
  if (active && slide.backgroundVideoSrc) {
    return <BannerBackgroundVideo src={slide.backgroundVideoSrc} poster={slide.backgroundImageSrc} className="absolute inset-0 h-full w-full object-cover object-center" />
  }
  if (slide.backgroundImageSrc) {
    return <Image src={slide.backgroundImageSrc} alt="" fill sizes="100vw" priority={priority} quality={85} className="object-cover object-center" />
  }
  return <SlideBackgroundFill slide={slide} />
}

// Resolves a theme radius token to a real px number (Framer Motion can't tween
// a raw `var(--radius-...)` string), floored so a 0-radius theme still reads
// as a deliberate rounded shape for editorial flourishes like Emerge's reveal
// panel or Story Rail's cards — not a themed control, so the floor is by
// design. Call from a lazy `useState(() => resolveRadiusPx(...))` initializer,
// not an effect, so it's ready on the very first render.
export function resolveRadiusPx(varName: string, floor: number): number {
  if (typeof document === 'undefined') return floor
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  const n = parseFloat(v)
  return Math.max(Number.isNaN(n) ? 0 : n, floor)
}

// ─── Content block — honors per-slide Content Placement and the block-wide
// Content Vertical Alignment setting. Originally Cinematic-only; Emerge
// reuses it verbatim (as a third consumer, alongside Cinematic's background
// and Story Rail's cards, of this file's shared rendering pieces) so both
// styles resolve placement/alignment identically rather than maintaining two
// copies of the same left/center/right + top/center/bottom mapping. Only the
// `variants` (timing/easing of the fade+rise) differ per style. ────────────

export function SlideContent({
  slide, headingLevel, verticalAlign, height, index, count, reducedMotion, variants,
}: {
  slide: SlideData
  headingLevel: 'h1' | 'h2'
  verticalAlign: SliderStyleOptions['contentVerticalAlign']
  height: SliderStyleOptions['height']
  index: number
  count: number
  reducedMotion: boolean
  variants: Variants
}) {
  const Heading  = headingLevel
  const hasMedia = hasMediaFor(slide)
  const forcedTheme = forcedThemeFor(slide.backgroundColor, hasMedia)
  const isFrosted = slide.overlay === 'frostedPanel' && hasMedia
  // Accent's solid fill (no media) is the one case where the CTA's ghost
  // button needs to flip to dark: Button's ghost variant defaults to a light
  // fg/border (tuned for sitting on brand/media dark grounds) and only reads
  // dark from `data-surface="light"`, a separate signal from `data-theme`
  // (see Button.tsx / globals.css [data-surface="light"]).
  const lightSurface = needsLightSurface(slide.backgroundColor, hasMedia)

  // Center falls back to left only in Editorial Split; every other consumer
  // of this component honors Center directly, so this is a plain 1:1 mapping.
  const placement = slide.contentPlacement ?? 'left'

  // Belt-and-suspenders legibility: over media, an always-on soft text shadow
  // so contrast doesn't depend entirely on getting Overlay + Content Placement
  // to agree (e.g. a Left Fade overlay with content placed on the right).
  // Skipped under the frosted-panel treatment, whose glass backdrop already
  // guarantees contrast on its own.
  const shadowClass = hasMedia && !isFrosted ? 'slider-text-shadow' : undefined

  const body = slide.body ? (
    <div data-rich-text="" data-color={forcedTheme === 'dark' ? 'brand' : undefined} className={cn('text-body leading-body text-pretty max-w-[60ch]', textRoleClass('body', slide.backgroundColor, hasMedia), shadowClass)}>
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
          className={cn('text-label font-semibold tracking-label uppercase underline underline-offset-4 decoration-1 hover:opacity-70 transition-opacity', textRoleClass('heading', slide.backgroundColor, hasMedia), shadowClass)}
        >
          {slide.secondaryLabel}
        </Link>
      )}
    </div>
  ) : null

  const inner = (
    <>
      {slide.eyebrow && <p className={cn('text-label font-semibold tracking-label uppercase', textRoleClass('eyebrow', slide.backgroundColor, hasMedia), shadowClass)}>{slide.eyebrow}</p>}
      {slide.headline && <Heading className={cn(headingClassForHeight(height), 'font-extrabold text-balance mt-xs', textRoleClass('heading', slide.backgroundColor, hasMedia), shadowClass)}>{slide.headline}</Heading>}
      {body && <div className="mt-sm">{body}</div>}
      {ctas}
    </>
  )

  return (
    <motion.div
      key={index}
      data-theme={forcedTheme}
      data-surface={lightSurface ? 'light' : undefined}
      role="group"
      aria-roledescription="slide"
      aria-label={`Slide ${index + 1} of ${count}`}
      variants={reducedMotion ? { enter: { opacity: 0 }, center: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.15 } } } : variants}
      initial="enter"
      animate="center"
      exit="exit"
      className={cn(
        'flex flex-col',
        contentMaxWidthClass(height),
        // Left/right placements sit near the arrow controls, so they get a
        // deliberately larger inline gutter than center's plain px — mx-auto
        // already gives center its own breathing room via the max-width cap.
        placement === 'center' && 'items-center text-center mx-auto px-md lg:px-xl',
        placement === 'right'  && 'items-end text-right ml-auto pl-md lg:pl-lg pr-lg lg:pr-2xl',
        placement === 'left'   && 'items-start text-left pr-md lg:pr-lg pl-lg lg:pl-2xl',
        isFrosted && 'banner-glass px-lg py-lg lg:px-xl lg:py-xl',
        isFrosted && (slide.backgroundColor === 'brand' ? 'banner-glass-brand'
          : slide.backgroundColor === 'brandDeep' ? 'banner-glass-brandDeep'
          : slide.backgroundColor === 'accent'    ? 'banner-glass-accent'
          : slide.backgroundColor === 'surface'   ? 'banner-glass-surface'
          : ''),
      )}
      style={{
        alignSelf: verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center',
      }}
    >
      {inner}
    </motion.div>
  )
}
