'use client'

import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import StatTile, { type StatItem, type StatEffect } from './StatTile'

export type { StatItem, StatEffect }

export type StatBlockStyleOptions = {
  columns?:      2 | 3 | 4
  color?:        'brand' | 'canvas' | 'surface'
  /** Wraps the stat row in a frosted glass panel layered over the background color */
  glass?:        boolean
  showIcons?:    boolean
  /** 'inline' (default) — icon left of the label row. 'above' — icon centered above the numeral. */
  iconPlacement?: 'inline' | 'above'
  animate?:      boolean
}

// ─── CVA variants ─────────────────────────────────────────────────────────────

const sectionPaddingCva = cva('px-md lg:px-lg', {
  variants: {
    columns: {
      2: 'py-md lg:py-lg',
      3: 'py-md lg:py-lg',
      4: 'py-sm lg:py-md',
    },
  },
  defaultVariants: { columns: 3 },
})

// Returns the section background class. Brand always uses the rich gradient fill
// (so backdrop-filter on child .bg-glass cards has tonal variance to blur against).
// Canvas/surface with glass use the banner gradient backdrops — same reason.
function sectionBgClass(color: 'brand' | 'canvas' | 'surface', glass: boolean): string {
  if (color === 'brand') return 'bg-brand-fill'
  if (glass) return color === 'surface' ? 'banner-bg-surface-glass' : 'banner-bg-canvas-glass'
  return color === 'surface' ? 'bg-surface' : 'bg-canvas'
}

const gridCva = cva('grid', {
  variants: {
    columns: {
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-2 md:grid-cols-4',
    },
  },
  defaultVariants: { columns: 3 },
})

/** Block header eyebrow — small uppercase tag above the heading */
const eyebrowCva = cva('text-label tracking-label uppercase font-semibold', {
  variants: {
    color: {
      brand:   'text-fg-on-brand/85',
      canvas:  'text-brand',
      surface: 'text-brand',
    },
  },
  defaultVariants: { color: 'brand' },
})

/** Block header heading — editorial headline above the stat row */
const headingCva = cva('text-headline font-bold tracking-headline leading-headline text-balance', {
  variants: {
    color: {
      brand:   'text-fg-on-brand',
      canvas:  'text-fg',
      surface: 'text-fg',
    },
  },
  defaultVariants: { color: 'brand' },
})

// ─── Animation constants ──────────────────────────────────────────────────────

const STAGGER_MS = 110   // per-column stagger, shared with the row's entrance trigger

// Numeral scale per column count — matches StatTile's `size` variants.
function sizeForColumns(columns: 2 | 3 | 4): 'lg' | 'md' | 'sm' {
  return columns === 2 ? 'lg' : columns === 4 ? 'sm' : 'md'
}

// ─── Component ────────────────────────────────────────────────────────────────

export type StatBlockProps = {
  eyebrow?:      string
  heading?:      string
  stats:         StatItem[]
  styleOptions?: StatBlockStyleOptions
  /** Numeral visual effect — sourced from the CMS content property, not display settings. */
  effect?:       StatEffect
}

export default function StatBlock({
  eyebrow,
  heading,
  stats,
  styleOptions = {},
  effect = 'none',
}: StatBlockProps) {
  const {
    columns       = 3,
    color         = 'brand',
    glass         = false,
    showIcons     = false,
    iconPlacement = 'inline',
    animate       = true,
  } = styleOptions

  const iconAbove = showIcons && iconPlacement === 'above'

  const ref = useRef<HTMLElement>(null)

  // shouldAnim: true once we confirm client + motion pref + animate prop
  const [shouldAnim, setShouldAnim] = useState(false)
  // entered: true when the row crosses into viewport — shared by every tile
  // so the whole row's entrance triggers off one observer, staggered by index.
  const [entered, setEntered] = useState(false)

  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const willAnimate = animate && !prefersReducedMotion
    setShouldAnim(willAnimate)

    if (!willAnimate) {
      setEntered(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEntered(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [animate, prefersReducedMotion])

  const mobileBorderClass = color === 'brand' ? 'border-fg-on-brand/15' : 'border-fg/10'
  const dividerBgClass    = color === 'brand' ? 'bg-fg-on-brand/15'     : 'bg-fg/10'

  // Extra bottom room so the stats don't sit flush against the section's
  // bottom edge — pairs with the header's mb above the grid for balance.
  const outerClass = cn(sectionPaddingCva({ columns }), sectionBgClass(color, glass), 'pb-lg lg:pb-xl')

  // Glass: each stat is its own frosted card separated by a gap (the section
  // color shows through the gaps). Non-glass: a single continuous row with
  // hairline dividers between items.
  const grid = (
    <ul className={cn(gridCva({ columns }), glass && 'gap-sm md:gap-md')} role="list">
      {stats.map((stat, i) => {
        const staggerMs = i * STAGGER_MS

        // ── Vertical column divider draw-in (scaleY from top) ────────────────
        const dividerStyle: React.CSSProperties = shouldAnim
          ? {
              transform:       entered ? 'scaleY(1)' : 'scaleY(0)',
              transformOrigin: 'top center',
              /* dur-exempt: 0.75s — divider scaleY draw; nearest token slow(600ms) Δ150ms, would change feel */
              transition:      `transform 0.75s var(--ot-ease-kinetic) ${staggerMs + 320}ms`,
            }
          : {}

        return (
          <li
            key={i}
            className={cn(
              'relative',
              !glass && [
                iconAbove ? 'py-md md:py-lg px-md' : 'py-md md:py-lg px-md md:pl-xl md:pr-0',
                // Mobile horizontal separator — 4-col uses 2×2 grid so suppress
                // the border on the 2nd item (it shares a row with item 1).
                columns === 4
                  ? `border-t ${mobileBorderClass} first:border-t-0 [&:nth-child(2)]:border-t-0 md:border-t-0`
                  : `border-t ${mobileBorderClass} first:border-t-0 md:border-t-0`,
              ],
            )}
          >
            {/* ── Vertical column divider — desktop, continuous row only ──── */}
            {!glass && i > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-0 top-md bottom-md w-px',
                  columns === 3 && i === 2 ? 'hidden lg:block' : 'hidden md:block',
                  dividerBgClass,
                )}
                style={dividerStyle}
              />
            )}

            <StatTile
              stat={{ ...stat, icon: showIcons ? stat.icon : undefined }}
              styleOptions={{ color, glass, iconPlacement, animate }}
              effect={effect}
              entered={entered}
              staggerMs={staggerMs}
              variant={glass ? 'card' : 'row'}
              size={sizeForColumns(columns)}
            />
          </li>
        )
      })}
    </ul>
  )

  // brand fill is always dark — assert dark theme so nested tokens resolve correctly.
  // Canvas/surface glass stays in its natural (light) theme; the banner-glass* panel
  // classes are designed for light mode and use canvas/surface-derived tints.
  const isDarkSurface = color === 'brand'

  const header = (eyebrow || heading) ? (
    <header className="flex flex-col gap-xs mb-lg lg:mb-xl max-w-screen-md">
      {eyebrow && <p className={eyebrowCva({ color })}>{eyebrow}</p>}
      {heading && <h2 className={headingCva({ color })}>{heading}</h2>}
    </header>
  ) : null

  return (
    <section
      ref={ref}
      className={outerClass}
      data-theme={isDarkSurface ? 'dark' : undefined}
      aria-label="Key metrics"
      data-block="stat"
    >
      {/* Section color bleeds full width; content is capped so whitespace at
          the margins reads as composed rather than stretched on wide screens. */}
      <div className="max-w-[80rem] mx-auto">
        {header}
        {grid}
      </div>
    </section>
  )
}
