'use client'

import { Children, forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal, Check, X, type LucideIcon } from 'lucide-react'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

// ─── Shared filter-drawer system ────────────────────────────────────────────
// Every content list (blog, events, locations) and search now opens its filter
// UI the same way: a `signal`-styled trigger button that slides a left-anchored
// drawer over the page, rather than a permanent inline chip row competing for
// space with the results themselves.

export type FilterOption<T> = {
  value: T
  label: string
  count?: number
}

// ─── FilterTriggerButton ────────────────────────────────────────────────────
// Composed from the same primitives as Button's `signal` variant (.btn-signal
// kinetic fill-sweep, brand border, delayed text-color crossfade) rather than
// extending Button itself, since Button doesn't support a leading count badge.
// The button itself stays compact — icon + "Filters" only, no boxed icon tile
// (a colored tile behind an icon that then fills the same color on hover is
// how the icon disappeared) — and the descriptive line sits underneath as
// plain caption text, outside the clickable surface. When the drawer is open
// the sweep is pinned filled — the button becomes the pressed, permanent
// "you are here" state instead of a hover-only flourish.

export const FilterTriggerButton = forwardRef<HTMLButtonElement, {
  open: boolean
  onClick: () => void
  activeCount: number
  idleSubtitle?: string
  panelId: string
}>(function FilterTriggerButton({
  open,
  onClick,
  activeCount,
  idleSubtitle = 'Add filters to narrow down results.',
  panelId,
}, ref) {
  const subtitle = activeCount > 0
    ? `${activeCount} filter${activeCount === 1 ? '' : 's'} applied`
    : idleSubtitle

  const iconTextClass = open
    ? 'text-fg-on-brand'
    : 'text-brand motion-safe:transition-colors motion-safe:duration-150 motion-safe:delay-75 motion-safe:group-hover:text-fg-on-brand'

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={panelId}
      aria-haspopup="dialog"
      className={[
        'group relative inline-flex flex-wrap items-center gap-x-sm gap-y-1 overflow-hidden rounded-full border border-brand px-md py-sm text-left',
        'transition-colors duration-150 ease-quick',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        open ? 'bg-brand' : 'btn-signal bg-surface',
      ].join(' ')}
    >
      <SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden className={`relative z-10 shrink-0 ${iconTextClass}`} />
      <span className={`relative z-10 text-body font-semibold ${open ? 'text-fg-on-brand' : 'text-fg motion-safe:transition-colors motion-safe:duration-150 motion-safe:delay-75 motion-safe:group-hover:text-fg-on-brand'}`}>
        Filters
      </span>
      {activeCount > 0 && (
        <span
          aria-hidden
          className={[
            'relative z-10 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-0.75 text-[10px] font-bold tabular-nums',
            open ? 'bg-fg-on-brand text-brand' : 'bg-brand text-fg-on-brand',
          ].join(' ')}
        >
          {activeCount}
        </span>
      )}
      <span className={`relative z-10 text-label leading-snug ${open ? 'text-fg-on-brand/70' : 'text-fg-muted motion-safe:transition-colors motion-safe:duration-150 motion-safe:delay-75 motion-safe:group-hover:text-fg-on-brand/70'}`}>
        {subtitle}
      </span>
    </button>
  )
})

// ─── FilterDrawer ───────────────────────────────────────────────────────────
// Mirrors the mechanics already shipping in SidebarNavClient (fixed inset-y-0
// left-0, translateX timed with --ot-ease-kinetic, chromatic brand-bloom
// shadow) rather than inventing new drawer physics, plus the portal/Escape/
// scroll-lock precedent from MobileMenu. The entrance adds two things neither
// of those had to: a hair of skew that un-skews as it lands (the panel
// "arrives" rather than just translating), and a staggered fade-up of each
// filter group once the panel is in place.

export function FilterDrawer({
  id,
  open,
  onClose,
  title = 'Refine',
  activeCount,
  onClearAll,
  triggerRef,
  children,
}: {
  id: string
  open: boolean
  onClose: () => void
  title?: string
  activeCount: number
  onClearAll?: () => void
  /** The trigger button's ref — focus returns here on close. */
  triggerRef: React.RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  // Below `sm` the left-edge drawer reads like a stray nav panel rather than a
  // filter control, so narrow viewports get a top-anchored dropdown sheet
  // instead — same panel, same state, different geometry only.
  const [isDesktop, setIsDesktop] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia('(min-width: 640px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      trigger?.focus()
    }
  }, [open, onClose, triggerRef])

  if (!mounted) return null

  const dur = prefersReducedMotion ? 1 : 420

  const closedTransform = isDesktop
    ? `translateX(-100%) skewX(${prefersReducedMotion ? 0 : -1.5}deg)`
    : `translateY(-100%) skewY(${prefersReducedMotion ? 0 : -0.6}deg)`

  return createPortal(
    <div aria-hidden={!open} className={`fixed inset-0 z-300 ${open ? '' : 'pointer-events-none'}`}>
      <div
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 bg-canvas/70 backdrop-blur-[2px] transition-opacity ease-quick"
        style={{ opacity: open ? 1 : 0, transitionDuration: `${prefersReducedMotion ? 1 : 200}ms` }}
      />

      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={[
          'absolute flex flex-col bg-surface outline-none',
          isDesktop
            ? 'inset-y-0 left-0 w-[min(88vw,380px)] border-r border-fg/10'
            : 'inset-x-0 top-0 max-h-[85vh] border-b border-fg/10',
        ].join(' ')}
        style={{
          transform: open ? 'translateX(0) translateY(0) skewX(0deg) skewY(0deg)' : closedTransform,
          transition: `transform ${dur}ms var(--ot-ease-kinetic)`,
        }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-fg/10 px-lg py-md">
          <div className="flex items-center gap-sm text-fg">
            <SlidersHorizontal size={18} strokeWidth={2} aria-hidden className="text-brand" />
            <span className="text-title font-bold">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="p-xs text-fg-muted transition-colors duration-150 ease-quick hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Keyed on `open` so re-opening always replays the staggered reveal below. */}
        <div key={open ? 'open' : 'closed'} className="flex flex-1 flex-col gap-xl overflow-y-auto px-lg py-lg">
          {Children.toArray(children).map((child, i) => (
            <div
              key={i}
              className="motion-safe:animate-fade-in"
              style={{ animationDelay: `${80 + i * 70}ms` }}
            >
              {child}
            </div>
          ))}
        </div>

        {onClearAll && (
          <div className="shrink-0 border-t border-fg/10 px-lg py-md">
            <button
              type="button"
              onClick={onClearAll}
              disabled={activeCount === 0}
              className="w-full text-center text-label font-semibold uppercase tracking-label text-fg-muted transition-colors duration-150 ease-quick hover:text-fg disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ─── FilterRadioGroup ───────────────────────────────────────────────────────
// A single-select primary classification facet (event type, location label,
// search content type): one option is always "on." Selection state is a
// filled circle + checkmark + a background tint on the row, never a
// side-stripe border — DESIGN.md bans colored border-left/border-right
// accents on list items.

export function FilterRadioGroup<T>({
  icon: Icon,
  heading,
  ariaLabel,
  value,
  options,
  onSelect,
}: {
  icon: LucideIcon
  heading: string
  ariaLabel: string
  value: T
  options: FilterOption<T>[]
  onSelect: (value: T) => void
}) {
  return (
    <div>
      <div className="mb-md flex items-center gap-sm text-fg">
        <Icon size={18} strokeWidth={2} aria-hidden className="text-brand" />
        <span className="text-body font-bold">{heading}</span>
      </div>
      <div className="flex flex-col" role="radiogroup" aria-label={ariaLabel}>
        {options.map((opt, i) => {
          const active = value === opt.value
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(opt.value)}
              className={[
                'flex items-center gap-sm rounded-ot-control px-sm py-2.5 text-left transition-colors duration-150 ease-quick',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                active ? 'bg-brand/10' : 'hover:bg-fg/5',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ease-quick',
                  active ? 'border-brand bg-brand' : 'border-fg/25',
                ].join(' ')}
              >
                {active && <Check size={11} strokeWidth={3} className="text-fg-on-brand" />}
              </span>
              <span className={`min-w-0 flex-1 truncate text-body ${active ? 'font-semibold text-fg' : 'text-fg-muted'}`}>
                {opt.label}
              </span>
              {typeof opt.count === 'number' && (
                <span className={`shrink-0 text-label font-semibold tabular-nums ${active ? 'text-brand' : 'text-fg-muted/50'}`}>
                  {opt.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── FilterPillGroup ────────────────────────────────────────────────────────
// A tag-like secondary facet (blog/search topic): rounded-full pills, single-
// select-toggle (re-click the active pill to clear). Rounded-full here is a
// deliberate exception for tag/label chips, same as the Hero eyebrow and
// StoryRailSlide badges — not the banned "rounded pill button as default."

export function FilterPillGroup<T>({
  icon: Icon,
  heading,
  ariaLabel,
  value,
  options,
  onSelect,
  trailing,
}: {
  icon: LucideIcon
  heading: string
  ariaLabel: string
  value: T
  options: FilterOption<T>[]
  onSelect: (value: T) => void
  trailing?: ReactNode
}) {
  const [gen, setGen] = useState(0)
  const handleSelect = (v: T) => {
    setGen(g => g + 1)
    onSelect(v)
  }

  return (
    <div>
      <div className="mb-md flex items-center gap-sm text-fg">
        <Icon size={18} strokeWidth={2} aria-hidden className="text-brand" />
        <span className="text-body font-bold">{heading}</span>
      </div>
      <div className="flex flex-wrap items-center gap-xs">
        <div className="flex flex-wrap items-center gap-xs" role="group" aria-label={ariaLabel}>
          {options.map((opt, i) => {
            const active = value === opt.value
            return (
              <button
                key={i}
                type="button"
                aria-pressed={active}
                onClick={() => handleSelect(opt.value)}
                className={[
                  'cursor-pointer rounded-full border px-sm py-1.25 text-label font-semibold uppercase tracking-label transition-colors duration-150 ease-quick',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  active
                    ? 'border-transparent bg-brand text-fg-on-brand'
                    : 'border-fg/15 bg-transparent text-fg-muted hover:border-fg/30 hover:text-fg',
                ].join(' ')}
              >
                <span key={active ? gen : -1} className={active ? 'inline-block animate-chip-select' : 'inline-block'}>
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>
        {trailing}
      </div>
    </div>
  )
}
