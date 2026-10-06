'use client'

import {
  useCallback, useEffect, useMemo, useRef, useState,
  forwardRef, type HTMLAttributes,
} from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORIES, type ShowcaseItem } from './config'

// ─── EdgeFadeScroller ─────────────────────────────────────────────────────────
// A horizontal scroll lane that signals overflow with a soft edge fade. Used
// by the tier-1 category tabs, which stay a simple scroller since there are
// only ever a handful of categories. Tier-2 (the per-category item list) has
// its own mega-menu below instead — see ShowcaseNav.

const FADE = '2.5rem'

type EdgeScrollerProps = {
  scrollKey: string
  className?: string
  children: React.ReactNode
} & HTMLAttributes<HTMLDivElement>

const EdgeFadeScroller = forwardRef<HTMLDivElement, EdgeScrollerProps>(
  function EdgeFadeScroller({ scrollKey, className, children, ...rest }, forwardedRef) {
    const innerRef = useRef<HTMLDivElement>(null)
    const [edges, setEdges] = useState({ start: true, end: true })

    // Merge the internal ref with the forwarded ref so both stay in sync.
    const mergeRef = useCallback((node: HTMLDivElement | null) => {
      (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node
    }, [forwardedRef])

    const update = useCallback(() => {
      const el = innerRef.current
      if (!el) return
      const max = el.scrollWidth - el.clientWidth
      setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 })
    }, [])

    useEffect(() => {
      const el = innerRef.current
      if (!el) return
      update()
      el.addEventListener('scroll', update, { passive: true })
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => { el.removeEventListener('scroll', update); ro.disconnect() }
    }, [update])

    // Re-center the active chip on navigation.
    useEffect(() => {
      const el = innerRef.current
      if (!el) return
      const active = el.querySelector<HTMLElement>('[aria-current="page"]')
      if (active) {
        const lane = el.getBoundingClientRect()
        const chip = active.getBoundingClientRect()
        const clipped = chip.left < lane.left || chip.right > lane.right
        if (clipped) {
          const delta = (chip.left + chip.width / 2) - (lane.left + lane.width / 2)
          const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          el.scrollBy({ left: delta, behavior: reduce ? 'auto' : 'smooth' })
        }
      }
      update()
    }, [scrollKey, update])

    const mask =
      `linear-gradient(to right, transparent 0, #000 ${edges.start ? '0px' : FADE}, ` +
      `#000 calc(100% - ${edges.end ? '0px' : FADE}), transparent 100%)`

    return (
      <div
        ref={mergeRef}
        className={['overflow-x-auto overflow-y-hidden scrollbar-none', className]
          .filter(Boolean).join(' ')}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        {...rest}
      >
        {children}
      </div>
    )
  }
)

// ─── ShowcaseNav ──────────────────────────────────────────────────────────────

export default function ShowcaseNav() {
  const pathname  = usePathname()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeCategory = CATEGORIES.find(c => pathname.startsWith(c.match)) ?? null
  const allItems       = activeCategory?.items ?? []
  const hasSubItems    = allItems.length > 0

  function itemHrefFor(item: ShowcaseItem) {
    return item.href ?? `/showcase/${activeCategory!.slug}/${item.slug}`
  }
  function isItemActive(item: ShowcaseItem) {
    return !item.href && pathname.startsWith(itemHrefFor(item))
  }

  const currentItem = allItems.find(isItemActive) ?? null

  // Clear search when the user switches categories, and close the menu on
  // any navigation (covers clicks on plain <a> tags, which don't go through
  // a single shared onClick) — adjusted during render rather than in an
  // effect, since both are pure reactions to a prop (pathname) changing, not
  // a synchronization with an external system.
  const [prevCategorySlug, setPrevCategorySlug] = useState(activeCategory?.slug)
  if (prevCategorySlug !== activeCategory?.slug) {
    setPrevCategorySlug(activeCategory?.slug)
    setQuery('')
  }
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setMenuOpen(false)
  }

  // Close on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const q = query.trim().toLowerCase()
  const matches = useCallback((item: ShowcaseItem) => item.label.toLowerCase().includes(q), [q])

  // Categories that tag every item with a `group` (currently just Blocks) get
  // the grouped mega-menu, alphabetical within each group, groups in their
  // first-appearance order in config.ts. Categories that don't (Pages,
  // Layout, Theme) keep their original array order — Theme's items in
  // particular are ordered to match the playground's own section order.
  const hasGroups = allItems.some(item => item.group)

  const groupedSections = useMemo(() => {
    if (!hasGroups) return []
    const order: string[] = []
    const byGroup = new Map<string, ShowcaseItem[]>()
    for (const item of allItems) {
      const g = item.group ?? 'Other'
      if (!byGroup.has(g)) { byGroup.set(g, []); order.push(g) }
      byGroup.get(g)!.push(item)
    }
    return order
      .map(g => ({ name: g, items: [...byGroup.get(g)!].filter(matches).sort((a, b) => a.label.localeCompare(b.label)) }))
      .filter(g => g.items.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, hasGroups, q])

  const flatItems = hasGroups ? [] : allItems.filter(matches)
  const totalMatches = hasGroups ? groupedSections.reduce((n, g) => n + g.items.length, 0) : flatItems.length

  function ItemLink({ item }: { item: ShowcaseItem }) {
    const isActive = isItemActive(item)
    return (
      <a
        href={itemHrefFor(item)}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => setMenuOpen(false)}
        className={cn(
          'block px-2 py-1 rounded text-label font-medium truncate transition-colors duration-150 ease-quick',
          isActive ? 'bg-brand text-fg-on-brand' : 'text-fg-muted hover:text-fg hover:bg-fg/6',
        )}
      >
        {item.label}
      </a>
    )
  }

  return (
    <nav aria-label="Showcase navigation" className="sticky top-[var(--ot-site-header-h)] z-20 bg-canvas/92 backdrop-blur-md">

      {/* ── Tier 1: Category tabs ──────────────────────────────────────────── */}
      <EdgeFadeScroller
        scrollKey={pathname}
        className="flex items-stretch border-b border-fg/10"
      >
        <div className="hidden sm:flex items-center px-md shrink-0 border-r border-fg/10 select-none">
          <span className="text-[0.6rem] font-semibold tracking-[0.18em] uppercase text-fg-muted/35">
            Showcase
          </span>
        </div>

        {CATEGORIES.map(cat => {
          const isActive = pathname.startsWith(cat.match)
          return (
            <a
              key={cat.slug}
              href={cat.href}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'shrink-0 px-md py-3.75',
                'text-label font-semibold tracking-label uppercase',
                'border-b-2 -mb-px transition-colors duration-150 ease-quick',
                isActive
                  ? 'border-brand text-fg'
                  : 'border-transparent text-fg-muted hover:text-fg hover:border-fg/20',
              ].join(' ')}
            >
              {cat.label}
            </a>
          )
        })}
      </EdgeFadeScroller>

      {/* ── Tier 2: filter + mega-menu trigger ───────────────────────────── */}
      {hasSubItems && (
        <div ref={containerRef} className="relative border-b border-fg/10">
          <div className="flex items-center gap-sm px-md py-2">
            <div className={[
              'flex-1 flex items-center gap-sm rounded border px-sm py-1.5',
              'bg-fg/4 border-fg/15',
              'focus-within:border-brand/50 focus-within:bg-brand/3',
              'transition-colors duration-150 ease-quick',
            ].join(' ')}>
              <Search size={13} className="text-fg-muted/55 shrink-0" aria-hidden />
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setMenuOpen(true) }}
                onFocus={() => setMenuOpen(true)}
                placeholder={`Filter ${allItems.length} ${activeCategory?.label.toLowerCase() ?? 'items'}…`}
                aria-label="Filter showcase items"
                className="flex-1 min-w-0 bg-transparent text-label text-fg placeholder:text-fg-muted/50 outline-none"
              />
              {query && (
                <>
                  <span className="text-label tabular-nums text-fg-muted/50 shrink-0 font-mono">
                    {totalMatches}/{allItems.length}
                  </span>
                  <button
                    onClick={() => setQuery('')}
                    aria-label="Clear filter"
                    className="text-fg-muted/50 hover:text-fg transition-colors shrink-0"
                  >
                    <X size={12} />
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              className={[
                'flex items-center gap-xs shrink-0 pl-sm pr-2.5 py-1.5 rounded border',
                'text-label font-semibold tracking-label uppercase',
                'transition-colors duration-150 ease-quick',
                menuOpen
                  ? 'border-brand/50 bg-brand/8 text-fg'
                  : 'border-fg/15 bg-fg/4 text-fg hover:bg-fg/8',
              ].join(' ')}
            >
              <span className="max-w-40 truncate">{currentItem?.label ?? 'Browse all'}</span>
              <span className="font-normal normal-case tracking-normal text-fg-muted/50">({allItems.length})</span>
              <ChevronDown size={13} className={cn('transition-transform duration-150 ease-quick', menuOpen && 'rotate-180')} aria-hidden />
            </button>
          </div>

          {menuOpen && (
            <div
              role="menu"
              aria-label={`${activeCategory?.label ?? 'Items'} list`}
              className="absolute inset-x-0 top-full z-30 max-h-[75vh] overflow-y-auto border-b border-fg/10 bg-canvas shadow-lg p-md lg:p-lg"
            >
              {totalMatches === 0 ? (
                <p className="text-label italic text-fg-muted/35 select-none py-0.5">No matches</p>
              ) : hasGroups ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-lg">
                  {groupedSections.map(section => (
                    <div key={section.name}>
                      <p className="text-label tracking-label uppercase text-fg-muted/60 font-semibold mb-xs">
                        {section.name}
                      </p>
                      <div className="flex flex-col gap-0.5 -mx-2">
                        {section.items.map(item => <ItemLink key={item.slug} item={item} />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-lg gap-y-0.5 -mx-2">
                  {flatItems.map(item => <ItemLink key={item.slug} item={item} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </nav>
  )
}
