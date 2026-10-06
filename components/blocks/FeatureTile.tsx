'use client'

import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { ICON_REGISTRY, type LucideIcon } from '@/components/icons/iconRegistry'
import { ArrowUpRight } from 'lucide-react'
import { RichText } from '@optimizely/cms-sdk/react/richText'

const ICONS: Record<string, LucideIcon> = { ...ICON_REGISTRY }

// ─── Public types ─────────────────────────────────────────────────────────────

export type FeatureItem = {
  headline:  string
  body?:     Parameters<typeof RichText>[0]['content'] | null
  ctaLabel?: string
  ctaUrl?:   string
  icon?:     string
}

export type FeatureTileStyleOptions = {
  color?:     'canvas' | 'surface' | 'brand'
  /**
   * none:       Icons hidden regardless of slot configuration.
   * accent:     Icon (32px, bold stroke) to the left of the headline and
   *             body, vertically centered across both.
   * structural: Icon (36px) in a tinted tile above the headline.
   */
  iconStyle?: 'none' | 'accent' | 'structural'
  animate?:   boolean
}

// ─── CVA variants ─────────────────────────────────────────────────────────────

const featureHeadlineCva = cva(
  'text-title leading-title tracking-title font-semibold',
  {
    variants: {
      color: {
        canvas:  'text-fg',
        surface: 'text-fg',
        brand:   'text-fg-on-brand',
      },
    },
    defaultVariants: { color: 'canvas' },
  },
)

const featureBodyCva = cva('mt-xs text-body leading-body [&>p]:m-0 [&>p+p]:mt-xs', {
  variants: {
    color: {
      canvas:  'text-fg-muted',
      surface: 'text-fg-muted',
      brand:   'text-fg-on-brand/70',
    },
  },
  defaultVariants: { color: 'canvas' },
})

const featureCtaCva = cva(
  'inline-flex items-center gap-xs mt-sm min-h-[44px] text-label tracking-label font-semibold uppercase transition-opacity duration-150 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current',
  {
    variants: {
      color: {
        canvas:  'text-brand',
        surface: 'text-brand',
        brand:   'text-fg-on-brand',
      },
    },
    defaultVariants: { color: 'canvas' },
  },
)

const featureCardCva = cva(
  // feature-card-lift (globals.css) owns resting shadow + transition for transform,
  // box-shadow, and border-color — so hover:border-* here gets animated for free.
  'feature-card-lift rounded-ot-surface border p-lg',
  {
    variants: {
      color: {
        canvas:  'bg-surface border-fg/10 hover:border-fg/22',
        surface: 'bg-fg/6 border-fg/10 hover:border-fg/22',
        brand:   'bg-fg-on-brand/10 border-fg-on-brand/15 hover:border-fg-on-brand/30',
      },
    },
    defaultVariants: { color: 'canvas' },
  },
)

const iconCva = cva('flex-shrink-0', {
  variants: {
    color: {
      canvas:  'text-brand',
      surface: 'text-brand',
      brand:   'text-fg-on-brand/80',
    },
  },
  defaultVariants: { color: 'canvas' },
})

// ─── Component ────────────────────────────────────────────────────────────────

export type FeatureTileProps = {
  feature:       FeatureItem
  styleOptions?: FeatureTileStyleOptions
  /**
   * Row-level entrance state, shared across a grid so every tile enters off
   * one coordinated trigger. Omit to let the tile observe its own visibility
   * — used when it renders standalone in a column.
   */
  entered?:      boolean
  /** Per-tile delay in ms, for staggering a coordinated multi-tile entrance. */
  staggerMs?:    number
  /**
   * 'card' (default) — self-contained bordered/padded tile, for standalone
   * column placement. 'bare' — no self background/border/padding; the caller
   * (FeatureGridBlock's grid or ruled layout) supplies that chrome.
   */
  variant?:      'card' | 'bare'
  className?:    string
}

export default function FeatureTile({
  feature,
  styleOptions = {},
  entered: externalEntered,
  staggerMs = 0,
  variant = 'card',
  className,
}: FeatureTileProps) {
  const {
    color     = 'canvas',
    iconStyle = 'none',
    animate   = true,
  } = styleOptions

  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  const [shouldAnim, setShouldAnim]           = useState(false)
  const [internalEntered, setInternalEntered] = useState(false)

  const isControlled = externalEntered !== undefined
  const entered = isControlled ? externalEntered : internalEntered

  useEffect(() => {
    const willAnimate = animate && !prefersReducedMotion
    setShouldAnim(willAnimate)

    if (!willAnimate || isControlled) {
      if (!willAnimate) setInternalEntered(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInternalEntered(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [animate, prefersReducedMotion, isControlled])

  const Icon           = feature.icon ? ICONS[feature.icon] : null
  const showIcon       = iconStyle !== 'none' && !!Icon
  const showAccentIcon = showIcon && iconStyle === 'accent'

  const itemStyle: React.CSSProperties = shouldAnim
    ? {
        opacity:   entered ? 1 : 0,
        transform: entered ? 'none' : 'translateY(1rem)',
        transition: entered
          ? [
              `opacity 500ms var(--ot-ease-kinetic) ${staggerMs}ms`,
              `transform 500ms var(--ot-ease-kinetic) ${staggerMs}ms`,
            ].join(', ')
          : 'none',
      }
    : {}

  const textBlock = (
    <>
      <h3 className={featureHeadlineCva({ color })}>{feature.headline}</h3>

      {feature.body && (
        <div className={featureBodyCva({ color })}>
          <RichText content={feature.body} />
        </div>
      )}

      {feature.ctaLabel && feature.ctaUrl && (
        <a href={feature.ctaUrl} className={featureCtaCva({ color })}>
          {feature.ctaLabel}
          <ArrowUpRight
            size={12}
            strokeWidth={2.5}
            aria-hidden="true"
            className="motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-quick motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
          />
        </a>
      )}
    </>
  )

  return (
    <div
      ref={ref}
      className={cn(
        // A grid item's own box stretches to the row height by default, but a
        // block child (this div) doesn't inherit that — without h-full here,
        // two same-row cards with different text lengths render as visibly
        // uneven boxes even though their row track is already equal height.
        variant === 'card' && 'h-full',
        variant === 'card' && featureCardCva({ color }),
        className,
      )}
      style={itemStyle}
    >
      {showIcon && iconStyle === 'structural' && (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex items-center justify-center w-16 h-16 mb-md rounded-ot-control motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-quick motion-safe:group-hover:scale-110',
            color === 'brand' ? 'bg-fg-on-brand/10' : 'bg-fg/8',
            iconCva({ color }),
          )}
        >
          <Icon size={36} strokeWidth={1.75} />
        </span>
      )}

      {showAccentIcon ? (
        <div className="flex items-center gap-md">
          <span
            aria-hidden="true"
            className={cn('inline-flex motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-quick motion-safe:group-hover:scale-110', iconCva({ color }))}
          >
            <Icon size={32} strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">{textBlock}</div>
        </div>
      ) : (
        textBlock
      )}
    </div>
  )
}
