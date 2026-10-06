import Image    from 'next/image'
import Link     from 'next/link'
import { cva } from 'class-variance-authority'
import { cn }  from '@/lib/utils'
import { RichText } from '@optimizely/cms-sdk/react/richText'
import BannerEntrance from './BannerEntrance'
import BannerBackgroundVideo from './BannerBackgroundVideo'
import { OT_COLOR_FILL_CLASS } from '@/lib/colorTokens'

// ─── Style option types ───────────────────────────────────────────────────────

export type BannerStyleOptions = {
  color?:      'canvas' | 'surface' | 'brand' | 'brandDeep' | 'accent'
  alignment?:  'center' | 'left'
  size?:       'large'  | 'compact' | 'display'
  treatment?:  'scrim'  | 'glass' | 'none'
  imageBlend?: 'overlay' | 'multiply'
}

// ─── CVA configs ─────────────────────────────────────────────────────────────

const sectionCva = cva(
  'relative overflow-hidden flex items-center border-y border-fg/5',
  {
    variants: {
      size: {
        large:   'min-h-[clamp(400px,50vh,560px)] py-xl',
        compact: 'min-h-[clamp(240px,30vh,360px)] py-lg',
        display: 'min-h-[clamp(440px,55vh,640px)] py-xl',
      },
    },
    defaultVariants: { size: 'large' },
  }
)

const eyebrowCva = cva(
  'text-label font-semibold tracking-label uppercase',
  {
    variants: {
      color: {
        canvas:    'text-accent',
        surface:   'text-accent',
        brand:     'text-fg-on-brand/70',
        brandDeep: 'text-fg-on-brand/70',
        accent:    'text-fg-on-accent/70',
      },
    },
    defaultVariants: { color: 'canvas' },
  }
)

const headingCva = cva(
  'font-sans font-bold tracking-headline leading-headline text-balance',
  {
    variants: {
      color: {
        canvas:    'text-fg',
        surface:   'text-fg',
        brand:     'text-fg-on-brand',
        brandDeep: 'text-fg-on-brand',
        accent:    'text-fg-on-accent',
      },
      size: {
        large:   'text-[clamp(2.5rem,5vw,3.75rem)]',
        compact: 'text-headline',
        // leading-display-safe (1.15) overrides the 0.9 display token — at display
        // scale on this overflow-hidden ground, 0.9 would clip descenders.
        display: 'text-display leading-display-safe tracking-display font-extrabold',
      },
    },
    defaultVariants: { color: 'canvas', size: 'large' },
  }
)

const bodyCva = cva(
  'font-sans font-light text-body leading-body text-pretty max-w-(--ot-measure-tight) [&_p]:mt-0',
)

const primaryCtaCva = cva(
  [
    'inline-block rounded-ot-control text-label font-semibold tracking-label uppercase',
    'px-12 py-4 transition duration-150 ease-quick',
    'hover:-translate-y-0.5 hover:shadow-hover-lift active:translate-y-0',
    'focus-visible:outline-2 focus-visible:outline-offset-[3px]',
  ],
  {
    variants: {
      color: {
        canvas:    'bg-accent text-fg-on-accent hover:bg-accent-hover focus-visible:outline-accent',
        surface:   'bg-accent text-fg-on-accent hover:bg-accent-hover focus-visible:outline-accent',
        brand:     'bg-brand-hover text-fg-on-brand focus-visible:outline-fg-on-brand',
        // Deeper section ground → button pops back to the standard (lighter)
        // brand fill, settling into brand-hover on hover — an inversion of the
        // `brand` variant above, so the button always reads a shade apart from
        // whatever brand-family surface it sits on.
        brandDeep: 'bg-brand text-fg-on-brand hover:bg-brand-hover focus-visible:outline-fg-on-brand',
        // Accent bg is a constant light, high-chroma green in both modes, so its
        // button uses the theme-invariant dark/light pair (fg-on-accent / accent)
        // rather than the generic fg tokens, which would otherwise track the
        // page's ambient theme and could collide with the fixed accent ground.
        accent:    'bg-fg-on-accent text-accent hover:bg-fg-on-accent/85 focus-visible:outline-fg-on-accent',
      },
    },
    defaultVariants: { color: 'canvas' },
  }
)

const secondaryCtaCva = cva(
  [
    'inline-block rounded-ot-control border text-label font-semibold tracking-label uppercase',
    'px-12 py-4 transition duration-150 ease-quick',
    'hover:-translate-y-0.5 active:translate-y-0',
    'focus-visible:outline-2 focus-visible:outline-offset-[3px]',
  ],
  {
    variants: {
      color: {
        canvas:    'border-fg/25 text-fg hover:border-fg/55 hover:bg-fg/5 focus-visible:outline-fg',
        surface:   'border-fg/25 text-fg hover:border-fg/55 hover:bg-fg/5 focus-visible:outline-fg',
        brand:     'border-fg-on-brand/35 text-fg-on-brand hover:border-fg-on-brand/65 hover:bg-fg-on-brand/5 focus-visible:outline-fg-on-brand',
        brandDeep: 'border-fg-on-brand/35 text-fg-on-brand hover:border-fg-on-brand/65 hover:bg-fg-on-brand/5 focus-visible:outline-fg-on-brand',
        accent:    'border-fg-on-accent/35 text-fg-on-accent hover:border-fg-on-accent/65 hover:bg-fg-on-accent/5 focus-visible:outline-fg-on-accent',
      },
    },
    defaultVariants: { color: 'canvas' },
  }
)

// ─── Scrim / background class helper ────────────────────────────────────────
//
// No media (scrim/none): this layer IS the banner background, so it uses the
//                    FULL solid color — a partial alpha would wash the brand
//                    out (the brand color must read as the brand color, not
//                    a tint).
// Media (scrim):     a colored overlay so the image/video reads through, tinted
//                    to the color; opacity scales with imageBlend (overlay =
//                    lighter, multiply = heavier press). Same treatment for
//                    video as image — it's keyed on "is there something busy
//                    behind the text," not on the media type.
// Glass:             intentionally translucent frosted panel (its identity);
//                    left as-is whether or not there's media behind it.
// Media + none:      no overlay at all — the image/video renders as-is and
//                    text/buttons sit directly on top of it.

function getScrimClass(
  color:       string,
  imageBlend:  string,
  treatment:   string,
  hasMedia:    boolean,
): string {
  if (treatment === 'none' && hasMedia) {
    return ''
  }
  if (treatment === 'glass') {
    if (!hasMedia) {
      // Rich gradient backdrops — give backdrop-filter tonal variance to frost over.
      // A flat solid color makes backdrop-filter invisible; these give it something.
      const map: Record<string, string> = {
        canvas:    'banner-bg-canvas-glass',
        surface:   'banner-bg-surface-glass',
        brand:     'banner-bg-brand-glass',
        brandDeep: 'banner-bg-brandDeep-glass',
        accent:    'banner-bg-accent-glass',
      }
      return map[color] ?? 'banner-bg-canvas-glass'
    }
    // With media: very light tint so the image/video bleeds through strongly.
    // The glass panel + heavy blur handle legibility; the overlay only adds subtle color.
    const map: Record<string, string> = {
      canvas:    'bg-canvas/15',
      surface:   'bg-surface/18',
      brand:     'bg-brand/30',
      brandDeep: 'bg-brand-hover/30',
      accent:    'bg-accent/30',
    }
    return map[color] ?? 'bg-canvas/15'
  }
  // Solid color background when there is no image/video to show through
  // (covers both `scrim` and `none` — with nothing behind it to preserve
  // "as-is", `none` renders the same flat fill as `scrim`).
  if (!hasMedia) {
    return OT_COLOR_FILL_CLASS[color as keyof typeof OT_COLOR_FILL_CLASS] ?? OT_COLOR_FILL_CLASS.canvas
  }
  // Colored overlay over an image or video (treatment === 'scrim').
  const isMultiply = imageBlend === 'multiply'
  const map: Record<string, [string, string]> = {
    canvas:    ['bg-canvas/80',      'bg-canvas/90'],
    surface:   ['bg-surface/80',     'bg-surface/88'],
    brand:     ['bg-brand/70',       'bg-brand/80'],
    brandDeep: ['bg-brand-hover/70', 'bg-brand-hover/80'],
    accent:    ['bg-accent/70',      'bg-accent/80'],
  }
  const [ov, mu] = map[color as keyof typeof map] ?? map.canvas
  return isMultiply ? mu : ov
}

// ─── Component ────────────────────────────────────────────────────────────────

export type BannerBlockProps = {
  heading:       string
  headingLevel?: 'h1' | 'h2'
  eyebrow?:      string
  body?:         Parameters<typeof RichText>[0]['content'] | null
  bgImageSrc?:   string
  bgVideoSrc?:   string
  primaryCta?:   { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  styleOptions?: BannerStyleOptions
  pa?:           (prop?: string | { key: string }) => Record<string, string | undefined>
}

export default function BannerBlock({
  heading,
  headingLevel = 'h2',
  eyebrow,
  body,
  bgImageSrc,
  bgVideoSrc,
  primaryCta,
  secondaryCta,
  styleOptions = {},
  pa           = () => ({}),
}: BannerBlockProps) {
  const {
    color      = 'canvas',
    alignment  = 'center',
    size       = 'large',
    treatment  = 'scrim',
    imageBlend = 'overlay',
  } = styleOptions

  const isGlass       = treatment === 'glass'
  const isNone        = treatment === 'none'
  const isBrand       = color === 'brand'
  const isBrandFamily = color === 'brand' || color === 'brandDeep'
  const isAccent      = color === 'accent'
  const isCentered    = alignment === 'center'
  const hasImage      = Boolean(bgImageSrc)
  const hasVideo      = Boolean(bgVideoSrc)
  const hasMedia      = hasImage || hasVideo
  const scrimClass    = getScrimClass(color, imageBlend, treatment, hasMedia)
  const Heading       = headingLevel

  // canvas/surface follow the page's own theme; brand-family grounds are always
  // dark and accent is always light (both constant across modes), so those two
  // families force the descendant fg/fg-on-* tokens to resolve consistently
  // regardless of the ambient theme. Media (image/video) is treated as a dark
  // ground too, same as before — `none` inherits that same assumption, since
  // the editor is choosing a photo that's expected to read with light text on it.
  const forcedTheme = hasMedia
    ? 'dark'
    : isBrandFamily
      ? 'dark'
      : isAccent
        ? 'light'
        : undefined

  // ── Content elements (shared between scrim and glass layouts) ──────────────
  // When an image or video sits behind the label, accent-as-text is hard to
  // read, so the eyebrow becomes a filled accent pill (accent background +
  // assigned fg-on-accent text) for guaranteed contrast. Without media it
  // keeps the per-color text treatment. The outer <p> retains `banner-eyebrow`
  // either way so the entrance animation still targets it.
  const eyebrowEl = eyebrow ? (
    hasMedia ? (
      <p className="banner-eyebrow" {...pa('eyebrow')}>
        <span className="inline-flex items-center rounded-ot-control px-sm py-0.75 bg-accent text-fg-on-accent text-label uppercase tracking-label font-semibold">
          {eyebrow}
        </span>
      </p>
    ) : (isCentered && (color === 'canvas' || color === 'surface')) ? (
      // Centered canvas/surface banner: plain accent text in dark mode (good
      // contrast on the dark canvas), but in LIGHT mode a bright accent washes
      // out as text on the light canvas — so .banner-eyebrow-pill promotes it to
      // a filled accent pill with fg-on-accent text (rule in globals.css). Brand
      // family and accent grounds skip this — they already carry their own
      // guaranteed-contrast text color via eyebrowCva, independent of theme.
      // The nested span lets the pill hug the text while the <p> stays centered.
      <p className={cn('banner-eyebrow', eyebrowCva({ color }))} {...pa('eyebrow')}>
        <span className="banner-eyebrow-pill inline-flex items-center rounded-ot-control text-label uppercase tracking-label font-semibold">
          {eyebrow}
        </span>
      </p>
    ) : (
      <p className={cn('banner-eyebrow', eyebrowCva({ color }))} {...pa('eyebrow')}>
        {eyebrow}
      </p>
    )
  ) : null

  const headingEl = (
    <Heading className={cn('banner-heading', headingCva({ color, size }))} {...pa('heading')}>
      {heading}
    </Heading>
  )

  const richTextColor = isBrandFamily ? 'brand' : isAccent ? 'accent' : isGlass ? 'glass' : color

  const bodyEl = body ? (
    <div
      className={cn('banner-body', bodyCva())}
      data-rich-text=""
      data-color={richTextColor}
      {...pa('body')}
    >
      <RichText content={body} />
    </div>
  ) : null

  const ctasEl = (primaryCta || secondaryCta) ? (
    <div className={cn(
      'banner-ctas flex flex-wrap gap-sm',
      isCentered ? 'justify-center' : 'justify-start',
    )}>
      {primaryCta && (
        <Link href={primaryCta.href} className={primaryCtaCva({ color })} {...pa('primaryCtaLabel')}>
          {primaryCta.label}
        </Link>
      )}
      {secondaryCta && (
        <Link href={secondaryCta.href} className={secondaryCtaCva({ color })} {...pa('secondaryCtaLabel')}>
          {secondaryCta.label}
        </Link>
      )}
    </div>
  ) : null

  const gapClass = size === 'large' || size === 'display' ? 'gap-lg' : 'gap-md'
  const isDisplay = size === 'display'

  return (
    <section
      className={sectionCva({ size })}
      data-theme={forcedTheme}
    >

      {/* ── Background layer (z-0, absolute inset) ─────────────────────── */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        {/* Background video takes precedence over the image; the image (when
            also present) becomes the video's poster frame. */}
        {hasVideo ? (
          <BannerBackgroundVideo
            src={bgVideoSrc!}
            poster={bgImageSrc}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : hasImage ? (
          <Image
            src={bgImageSrc!}
            alt=""
            fill
            sizes="100vw"
            // Only the hero banner (h1 = page's primary heading) is the LCP
            // candidate and should preload. Secondary (h2) banners lazy-load so
            // multiple banners on a page don't all preload and hurt LCP.
            priority={headingLevel === 'h1'}
            quality={85}
            className="object-cover object-center"
          />
        ) : null}

        {/* Glass mode: extra base darkener so the panel has something to
            contrast against even when the image/video is light */}
        {isGlass && hasMedia && (
          <div className="absolute inset-0 bg-canvas/35" />
        )}

        {/* Scrim: color identity layer (controls how brand/canvas/surface reads).
            Treatment "none" over media renders no layer at all — the image/video
            shows as-is with nothing between it and the content on top. */}
        {scrimClass && <div className={cn('absolute inset-0', scrimClass)} />}

        {/* Vignette: subtle radial corner darkening; only with image/video, and
            skipped under "none" — it's an overlay effect too. */}
        {hasMedia && !isNone && <div className="banner-vignette absolute inset-0" />}

        {/* Brand bloom: radial warm halo centered behind content; skipped under
            "none" for the same reason. */}
        {isBrandFamily && !isNone && <div className="banner-brand-bloom absolute inset-0" />}
      </div>

      {/* ── Content layer (z-10) ────────────────────────────────────────── */}
      <BannerEntrance className={cn(
        'relative z-10 w-full px-md lg:px-lg',
        isCentered ? 'flex justify-center' : 'flex justify-start',
      )}>

        {isGlass ? (
          /* Glass treatment: content inside a frosted glass panel */
          <div
            className={cn(
              'flex flex-col',
              gapClass,
              size === 'large' ? 'px-xl py-xl' : isDisplay ? 'px-xl py-2xl' : 'px-lg py-lg',
              isCentered
                ? `items-center text-center ${isDisplay ? 'max-w-250' : 'max-w-160'} w-full`
                : `items-start text-left  ${isDisplay ? 'max-w-225' : 'max-w-140'} w-full`,
              isBrand               ? 'banner-glass-brand'
              : color === 'brandDeep' ? 'banner-glass-brandDeep'
              : color === 'accent'    ? 'banner-glass-accent'
              : color === 'surface'   ? 'banner-glass-surface'
              : 'banner-glass',
            )}
            // Motion under glass reads busier than a static photo at the same
            // blur level, so video gets a touch more blur/tint (globals.css).
            data-media={hasVideo ? 'video' : undefined}
          >
            {eyebrowEl}
            {headingEl}
            {bodyEl}
            {ctasEl}
          </div>
        ) : (
          /* Scrim treatment: content sits directly on the scrimmed image */
          <div className={cn(
            'flex flex-col',
            gapClass,
            isCentered
              ? `items-center text-center ${isDisplay ? 'max-w-250' : 'max-w-190'} w-full mx-auto`
              : `items-start text-left  ${isDisplay ? 'max-w-225' : 'max-w-160'} w-full`,
          )}>
            {eyebrowEl}
            {headingEl}
            {bodyEl}
            {ctasEl}
          </div>
        )}

      </BannerEntrance>

    </section>
  )
}
