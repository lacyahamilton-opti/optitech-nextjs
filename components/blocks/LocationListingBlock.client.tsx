'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import dynamic from 'next/dynamic'
import {
  Search, X, Map as MapIcon, LayoutGrid, List, MapPinned, SlidersHorizontal, Layers,
} from 'lucide-react'
import { FilterTriggerButton, FilterDrawer, FilterRadioGroup } from '@/components/ui/FilterDrawer'
import type { LocationData } from '@/lib/locations'
import { deriveLabelOptions, hasCoordinates } from '@/lib/locationFormat'
import type {
  LocationListingColumns,
  LocationListingStyleOptions,
  LocationListingView,
} from '@/cms/styling/OT_LocationListingBlock.styling'
import LocationCard from '@/components/location/LocationCard'
import LocationListRow from '@/components/location/LocationListRow'
import LocationRailCard from '@/components/location/LocationRailCard'
import LocationDetailsModal from '@/components/location/LocationDetailsModal'

// Mapbox GL needs a browser — never server-render it. The skeleton fills the map
// column's height (--map-h, set on the grid) so swapping in the real map causes
// no layout shift at either map height.
const LocationMap = dynamic(() => import('@/components/location/LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-(--map-h) w-full items-center justify-center rounded-ot-surface border border-fg/10 bg-surface">
      <span className="text-label uppercase tracking-label text-fg-muted/60">Loading map…</span>
    </div>
  ),
})

type Props = {
  locations:    LocationData[]
  styleOptions: LocationListingStyleOptions
  mapboxToken:  string
  emptyMessage: string
  /** True for any CMS draft/preview render — hides the filter trigger + drawer. */
  isPreview?:   boolean
}

const GRID_COLS: Record<LocationListingColumns, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
}

const MAP_HEIGHTS = { standard: 480, tall: 640 } as const

// ─── View toggle ───────────────────────────────────────────────────────────────

const VIEW_META: { view: LocationListingView; label: string; Icon: typeof MapIcon }[] = [
  { view: 'map',  label: 'Map view',  Icon: MapIcon },
  { view: 'grid', label: 'Grid view', Icon: LayoutGrid },
  { view: 'list', label: 'List view', Icon: List },
]

function ViewToggle({
  view,
  onChange,
}: {
  view: LocationListingView
  onChange: (v: LocationListingView) => void
}) {
  return (
    <div className="inline-flex flex-none rounded-ot-control overflow-hidden border border-fg/15" role="group" aria-label="Choose layout">
      {VIEW_META.map(({ view: v, label, Icon }, i) => {
        const active = view === v
        return (
          <button
            key={v}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => onChange(v)}
            className={
              'inline-flex h-12 w-12 items-center justify-center motion-safe:transition-colors duration-150 ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
              (i > 0 ? 'border-l border-fg/15 ' : '') +
              (active ? 'bg-brand text-fg-on-brand' : 'text-fg-muted hover:text-fg')
            }
          >
            <Icon size={16} strokeWidth={2} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

// ─── Directory client ─────────────────────────────────────────────────────────

export default function LocationListingClient({ locations, styleOptions, mapboxToken, emptyMessage, isPreview = false }: Props) {
  const { defaultView, showViewToggle, mapHeight, color, columns, showSearch, showLabelFilter, density } = styleOptions

  const [view, setView]                     = useState<LocationListingView>(defaultView)
  const [query, setQuery]                   = useState('')
  const [label, setLabel]                   = useState<string | null>(null)
  const [selectedKey, setSelectedKey]       = useState<string | null>(null)
  const [detailsLocation, setDetailsLocation] = useState<LocationData | null>(null)
  const [filtersOpen, setFiltersOpen]       = useState(false)
  const prefersReducedMotion          = usePrefersReducedMotion()
  const searchId = useId()
  const filterPanelId    = useId()
  const filterTriggerRef = useRef<HTMLButtonElement>(null)

  const onSurface = color === 'surface'
  const inputBg   = onSurface ? 'bg-canvas' : 'bg-surface'
  const mapPx     = MAP_HEIGHTS[mapHeight]

  const labelOptions = useMemo(() => deriveLabelOptions(locations), [locations])

  // Apply search + single label filter.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const lab = label?.toLowerCase() ?? null
    return locations.filter(l => {
      if (lab && (l.locationLabel ?? '').toLowerCase() !== lab) return false
      if (q) {
        const haystack = [l.locationName, l.locationLabel, l.address]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [locations, query, label])

  // Derive the effective selection rather than syncing it through an effect: a
  // selection that the active search/filter has removed from `results` simply
  // reads as null until it reappears. Handlers only ever set keys that are in
  // `results` (markers + rail cards render from `results`), so this is purely a
  // guard against a stale key after narrowing.
  const effectiveSelectedKey =
    selectedKey && results.some(l => l.key === selectedKey) ? selectedKey : null

  const railRefs   = useRef(new Map<string, HTMLDivElement | null>())
  const railScroll = useRef<HTMLDivElement | null>(null)

  // Scroll the selected rail card into view within the rail (not the page).
  useEffect(() => {
    if (!effectiveSelectedKey) return
    const el = railRefs.current.get(effectiveSelectedKey)
    el?.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [effectiveSelectedKey, prefersReducedMotion])

  const filtersActive = !!query || label !== null
  const clearAll = () => {
    setQuery('')
    setLabel(null)
  }

  // Hidden entirely in CMS preview/edit renders — live-front-end feature only.
  const showLabelFilterUI = showLabelFilter && labelOptions.length > 0 && !isPreview
  const hasControls = showSearch || showLabelFilterUI || showViewToggle
  const mappableCount = useMemo(() => results.filter(hasCoordinates).length, [results])

  return (
    <div>
      {/* ── Controls ── */}
      {hasControls && (
        <div className="mb-lg flex flex-col gap-md border-b border-fg/10 pb-md">
          <div className="flex items-center gap-md">
            {showSearch && (
              // Width cap uses the numeric spacing multiplier (136 = 34rem), NOT a
              // named size: this theme's spacing tokens shadow Tailwind's container
              // scale, so max-w-xl resolves to --spacing-xl (64px) and would
              // collapse the field.
              <div className="relative min-w-0 flex-1 max-w-136">
                <label htmlFor={searchId} className="sr-only">Search locations by name, label, or address</label>
                <Search size={18} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted" />
                <input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name, label, or address"
                  className={`${inputBg} h-12 w-full rounded-input border border-fg/15 pl-11 ${query ? 'pr-11' : 'pr-4'} text-base text-fg placeholder:text-fg-muted/60 motion-safe:transition-[border-color,box-shadow] duration-150 focus:border-brand focus:outline-none focus:[box-shadow:0_0_0_2px_var(--ot-bloom-brand-ring)] [&::-webkit-search-cancel-button]:appearance-none`}
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                    <X size={16} strokeWidth={2} aria-hidden />
                  </button>
                )}
              </div>
            )}

            {showViewToggle && (
              <div className="ml-auto flex-none">
                <ViewToggle view={view} onChange={setView} />
              </div>
            )}
          </div>

          {showLabelFilterUI && (
            <div className="flex flex-col gap-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <FilterTriggerButton
                ref={filterTriggerRef}
                open={filtersOpen}
                onClick={() => setFiltersOpen(v => !v)}
                activeCount={label ? 1 : 0}
                panelId={filterPanelId}
              />
              <div className="flex items-center gap-md">
                <p className="font-mono text-xs uppercase tracking-label text-fg-muted/70" aria-live="polite">
                  <span className="text-fg">{results.length}</span>{' '}
                  {results.length === 1 ? 'location' : 'locations'}
                </p>
                {filtersActive && (
                  <button type="button" onClick={clearAll} className="inline-flex items-center gap-xs text-label uppercase tracking-label font-semibold text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                    <X size={13} strokeWidth={2} aria-hidden />
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showLabelFilterUI && (
        <FilterDrawer
          id={filterPanelId}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          activeCount={label ? 1 : 0}
          onClearAll={() => setLabel(null)}
          triggerRef={filterTriggerRef}
        >
          <FilterRadioGroup
            icon={Layers}
            heading="Label"
            ariaLabel="Filter by label"
            value={label}
            onSelect={setLabel}
            options={[
              { value: null as string | null, label: 'All' },
              ...labelOptions.map(opt => ({ value: opt as string | null, label: opt })),
            ]}
          />
        </FilterDrawer>
      )}

      {/* ── Results ── */}
      {results.length === 0 ? (
        <EmptyState message={emptyMessage} filtersActive={filtersActive} onClear={clearAll} />
      ) : view === 'map' ? (
        <div className="grid gap-md lg:grid-cols-[26rem_1fr]" style={{ ['--map-h' as string]: `${mapPx}px` }}>
          {/* Rail — below the map on mobile, beside it (scrollable, matched height) on desktop.
              Keyed on the label filter (not the map, which must stay mounted — remounting the
              Mapbox instance on every filter change would flash the loading skeleton and refetch
              tiles) so a filter change fades the swapped-in cards in. */}
          <div
            key={label ?? 'all'}
            ref={railScroll}
            className="location-rail order-2 flex flex-col gap-sm lg:order-1 lg:h-(--map-h) lg:overflow-y-auto lg:pr-1 animate-filter-swap"
          >
            {results.map(l => (
              <div key={l.key} ref={el => { railRefs.current.set(l.key, el) }}>
                <LocationRailCard
                  location={l}
                  active={effectiveSelectedKey === l.key}
                  mappable={hasCoordinates(l)}
                  onSelect={() => setSelectedKey(l.key)}
                  onHover={() => setSelectedKey(l.key)}
                />
              </div>
            ))}
          </div>

          {/* Map */}
          <div className="order-1 lg:order-2">
            {mapboxToken ? (
              <LocationMap
                locations={results}
                selectedKey={effectiveSelectedKey}
                onSelectKey={setSelectedKey}
                onViewDetails={setDetailsLocation}
                token={mapboxToken}
                mapHeight={mapPx}
              />
            ) : (
              <div className="flex w-full flex-col items-center justify-center gap-sm rounded-ot-surface border border-fg/10 bg-surface p-lg text-center" style={{ height: mapPx }}>
                <MapPinned size={26} strokeWidth={1.5} className="text-fg-muted/60" aria-hidden />
                <p className="text-title font-semibold text-fg">Map unavailable</p>
                <p className="max-w-[40ch] text-sm text-fg-muted">
                  Set <code className="font-mono text-xs text-fg">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable the map. The list and grid views work without it.
                </p>
              </div>
            )}
            {mapboxToken && mappableCount < results.length && (
              <p className="mt-xs text-xs text-fg-muted/70">
                {results.length - mappableCount} of {results.length} not shown on the map (no resolvable address).
              </p>
            )}
          </div>
        </div>
      ) : view === 'list' ? (
        <ul key={label ?? 'all'} className={`flex flex-col animate-filter-swap ${density === 'compact' ? 'gap-sm' : 'gap-md'}`}>
          {results.map(l => (
            <li key={l.key}>
              <LocationListRow location={l} onSurface={onSurface} density={density} onOpenDetails={setDetailsLocation} />
            </li>
          ))}
        </ul>
      ) : (
        <ul key={label ?? 'all'} className={`grid grid-cols-1 animate-filter-swap ${GRID_COLS[columns]} ${density === 'compact' ? 'gap-sm' : 'gap-md'}`}>
          {results.map(l => (
            <li key={l.key} className="flex">
              <LocationCard location={l} density={density} onOpenDetails={setDetailsLocation} />
            </li>
          ))}
        </ul>
      )}

      <LocationDetailsModal location={detailsLocation} onClose={() => setDetailsLocation(null)} />
    </div>
  )
}

function EmptyState({ message, filtersActive, onClear }: { message: string; filtersActive: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-sm py-2xl text-center">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-ot-surface text-brand"
        style={{ background: 'oklch(from var(--ot-brand) l c h / 0.12)', border: '1px solid var(--ot-bloom-brand-border)' }}
        aria-hidden
      >
        {filtersActive ? <SlidersHorizontal size={24} strokeWidth={1.5} /> : <MapPinned size={24} strokeWidth={1.5} />}
      </span>
      <p className="text-title font-semibold text-fg">{message}</p>
      {filtersActive && (
        <button
          type="button"
          onClick={onClear}
          className="btn-signal mt-xs inline-flex items-center rounded-ot-control bg-brand text-fg-on-brand px-md py-sm text-label uppercase tracking-label font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="relative z-10">Clear search &amp; filters</span>
        </button>
      )}
    </div>
  )
}
