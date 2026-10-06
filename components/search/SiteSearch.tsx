'use client'

import { useEffect, useId, useRef, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Search, X, Maximize2, Minimize2, Check, ChevronDown,
  FileText, Newspaper, LayoutGrid, Sparkles, List, Layers, Tag,
  CalendarDays, MapPin, Video, ExternalLink, Code2,
} from 'lucide-react'
import { useSearch } from './SearchProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { SearchResult, AutocompleteSuggestion, AutocompleteType } from '@/lib/search'
import { formatEventDate, eventTypeLabel } from '@/lib/eventFormat'
import { FilterTriggerButton, FilterDrawer, FilterRadioGroup, FilterPillGroup } from '@/components/ui/FilterDrawer'

type DisplayMode = 'immersive' | 'compact'
type TypeFilter  = 'all' | 'Blog' | 'Page' | 'Event'
type ViewMode    = 'list' | 'card'

const DISPLAY_MODE_KEY = 'ot-search-mode'

const TYPE_FILTERS: { value: TypeFilter; label: string; Icon: typeof LayoutGrid }[] = [
  { value: 'all',   label: 'All',    Icon: LayoutGrid   },
  { value: 'Blog',  label: 'Blog',   Icon: Newspaper    },
  { value: 'Page',  label: 'Page',   Icon: FileText     },
  { value: 'Event', label: 'Events', Icon: CalendarDays },
]

// Suggestion group order + icon/label, reusing the same vocabulary as
// TYPE_FILTERS above so the typeahead groups read identically to the filter drawer.
const SUGGESTION_GROUP_ORDER: AutocompleteType[] = ['Blog', 'Event', 'Page']
const SUGGESTION_GROUP_META: Record<AutocompleteType, { label: string; Icon: typeof LayoutGrid }> = {
  Blog:  { label: 'Blog',   Icon: Newspaper    },
  Event: { label: 'Events', Icon: CalendarDays },
  Page:  { label: 'Pages',  Icon: FileText     },
}

function groupSuggestions(items: AutocompleteSuggestion[]) {
  const buckets = new Map<AutocompleteType, AutocompleteSuggestion[]>()
  for (const item of items) {
    if (!buckets.has(item.type)) buckets.set(item.type, [])
    buckets.get(item.type)!.push(item)
  }
  return SUGGESTION_GROUP_ORDER
    .filter(type => buckets.has(type))
    .map(type => ({ type, items: buckets.get(type)! }))
}

// Bolds every case-insensitive occurrence of `query` within `text` — the
// typed term stands out inside each suggestion, not just at the start of it.
function highlightMatch(text: string, query: string) {
  const q = query.trim()
  if (!q) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase()
      ? <mark key={i} className="bg-brand/20 text-fg font-bold not-italic">{part}</mark>
      : part
  )
}

function isCrossOriginUrl(url: string): boolean {
  if (!url.startsWith('http')) return false
  try { return new URL(url).origin !== window.location.origin }
  catch { return false }
}

function getHostLabel(url: string): string | null {
  try { return new URL(url).hostname }
  catch { return null }
}

function formatDate(iso?: string): string | null {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(iso))
  } catch { return null }
}

export default function SiteSearch() {
  const { isOpen, closeSearch } = useSearch()
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const { t } = useTranslation()

  const [mode,        setMode]        = useState<DisplayMode>('immersive')
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState<SearchResult[]>([])
  const [loading,     setLoading]     = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [typeFilter,  setTypeFilter]  = useState<TypeFilter>('all')
  const [topicFilter, setTopicFilter] = useState<string | null>(null)
  const [focusedIdx,  setFocusedIdx]  = useState(-1)
  const [mounted,     setMounted]     = useState(false)
  const [semantic,        setSemantic]        = useState(false)
  const [viewMode,        setViewMode]        = useState<ViewMode>('list')
  const [suggestions,     setSuggestions]     = useState<AutocompleteSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [focusedSugIdx,   setFocusedSugIdx]   = useState(-1)
  const [showDevPanel,    setShowDevPanel]    = useState(false)
  const [queryCopied,     setQueryCopied]     = useState(false)
  const [filtersOpen,     setFiltersOpen]     = useState(false)

  const inputRef           = useRef<HTMLInputElement>(null)
  const resultsRef         = useRef<HTMLElement>(null)
  const debounceRef        = useRef<ReturnType<typeof setTimeout>>(undefined)
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const suggestAutoCloseRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastSearchUrlRef   = useRef<string>('')
  const filterTriggerRef   = useRef<HTMLButtonElement>(null)
  const filterPanelId      = useId()

  useEffect(() => { setMounted(true) }, [])
  // The filter drawer belongs to the search overlay — closing search should
  // never leave it silently open for next time.
  useEffect(() => { if (!isOpen) setFiltersOpen(false) }, [isOpen])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DISPLAY_MODE_KEY)
      if (saved === 'compact' || saved === 'immersive') setMode(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (isOpen) {
      const tid = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(tid)
    } else {
      setQuery('')
      setResults([])
      setFocusedIdx(-1)
      setHasSearched(false)
      setTypeFilter('all')
      setTopicFilter(null)
      setSuggestions([])
      setShowSuggestions(false)
      setFocusedSugIdx(-1)
      setShowDevPanel(false)
    }
  }, [isOpen])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      const tid = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(tid)
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSearch() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, closeSearch])

  // Suggestions dropdown: dismiss on any click outside it, not just on input
  // blur. Blur alone missed the case where focus had already moved onto a
  // suggestion row (arrow-key navigation, or just clicking one of the rows
  // without selecting it) — nothing was listening for that row losing focus,
  // so the panel could outlive the input's own blur handler entirely.
  useEffect(() => {
    if (!showSuggestions) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      // The reopen chevron sits beside the input, not inside it — exempt the
      // whole input row (not just the bare <input>) so clicking that button
      // doesn't register as an "outside" click and immediately undo itself.
      if (target instanceof Element && target.closest('[data-search-input-row]')) return
      if (target instanceof Element && target.closest('[data-suggestions-list]')) return
      setShowSuggestions(false)
      setFocusedSugIdx(-1)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [showSuggestions])

  // Auto-collapse shortly after the panel appears, so a glance at it doesn't
  // require a manual dismiss every time — but only when it's never been
  // touched: hovering into the panel cancels this outright (onMouseLeave then
  // closes it immediately instead, see SuggestionList), and browsing it with
  // the keyboard cancels it too. Re-armed whenever the suggestion set changes
  // (still typing counts as "not shown yet").
  const SUGGESTION_AUTO_CLOSE_MS = 3200

  useEffect(() => {
    if (!showSuggestions) { clearTimeout(suggestAutoCloseRef.current); return }
    clearTimeout(suggestAutoCloseRef.current)
    suggestAutoCloseRef.current = setTimeout(() => {
      setShowSuggestions(false)
      setFocusedSugIdx(-1)
    }, SUGGESTION_AUTO_CLOSE_MS)
    return () => clearTimeout(suggestAutoCloseRef.current)
  }, [showSuggestions, suggestions])

  const runSearch = useCallback(async (q: string, type: TypeFilter, useSemanticSearch: boolean) => {
    if (q.trim().length < 2) { setResults([]); setHasSearched(false); return }
    setLoading(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams({ q: q.trim(), type })
      if (useSemanticSearch) params.set('semantic', 'true')
      const fetchUrl = `/api/search?${params}`
      lastSearchUrlRef.current = fetchUrl
      const res  = await fetch(fetchUrl)
      const data: SearchResult[] = await res.json()
      setResults(data)
      setFocusedIdx(-1)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setTopicFilter(null)
    setFocusedSugIdx(-1)

    clearTimeout(suggestDebounceRef.current)
    if (value.trim().length >= 2) {
      suggestDebounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(value.trim())}`)
          const data: AutocompleteSuggestion[] = await res.json()
          setSuggestions(data)
          setShowSuggestions(data.length > 0)
        } catch {}
      }, 150)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSearch(value, typeFilter, semantic)
    }, 350)
  }

  // Each suggestion is a specific content item (not just a query string), so
  // selecting one navigates straight there rather than re-running a text
  // search — mirrors handleResultClick's cross-origin handling below.
  const handleSuggestionSelect = (suggestion: AutocompleteSuggestion) => {
    setSuggestions([])
    setShowSuggestions(false)
    setFocusedSugIdx(-1)
    clearTimeout(debounceRef.current)
    clearTimeout(suggestDebounceRef.current)
    if (isCrossOriginUrl(suggestion.url)) {
      window.open(suggestion.url, '_blank', 'noopener,noreferrer')
    } else {
      router.push(suggestion.url)
    }
    closeSearch()
  }

  // "View all <type>" — keeps the current query, scopes the real results to
  // this type, and drops the typeahead in favor of the full results list.
  const handleViewAllType = (type: AutocompleteType) => {
    setSuggestions([])
    setShowSuggestions(false)
    setFocusedSugIdx(-1)
    handleTypeFilter(type)
  }

  const handleTypeFilter = (f: TypeFilter) => {
    if (f === typeFilter) return
    setTypeFilter(f)
    setTopicFilter(null)
    if (query.trim().length >= 2) runSearch(query, f, semantic)
  }

  const handleSemanticToggle = () => {
    const next = !semantic
    setSemantic(next)
    if (query.trim().length >= 2) runSearch(query, typeFilter, next)
  }

  const toggleMode = () => {
    setMode(prev => {
      const next: DisplayMode = prev === 'immersive' ? 'compact' : 'immersive'
      try { localStorage.setItem(DISPLAY_MODE_KEY, next) } catch {}
      return next
    })
  }

  const handleResultClick = useCallback((result: SearchResult) => {
    if (result._track) {
      // Fire-and-forget beacon — keepalive ensures it survives the navigation.
      // mode: no-cors because the tracking endpoint is cross-origin and needs no response.
      fetch(result._track, { method: 'GET', mode: 'no-cors', keepalive: true }).catch(() => {})
    }
    // Cross-site results (absolute URLs to a different origin) open in a new tab
    // so the user stays on the current site. Next.js router.push treats an external
    // absolute URL as a same-app route, stripping the domain.
    if (isCrossOriginUrl(result.url)) {
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } else {
      router.push(result.url)
    }
    closeSearch()
  }, [router, closeSearch])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        clearTimeout(suggestAutoCloseRef.current) // actively browsing — don't cut it off mid-navigation
        const next = Math.min(focusedSugIdx + 1, suggestions.length - 1)
        setFocusedSugIdx(next)
        document.querySelectorAll<HTMLElement>('[data-suggestion-item]')[next]?.focus()
        return
      }
      if (e.key === 'ArrowUp' && focusedSugIdx >= 0) {
        e.preventDefault()
        clearTimeout(suggestAutoCloseRef.current)
        if (focusedSugIdx === 0) {
          setFocusedSugIdx(-1)
          inputRef.current?.focus()
        } else {
          const prev = focusedSugIdx - 1
          setFocusedSugIdx(prev)
          document.querySelectorAll<HTMLElement>('[data-suggestion-item]')[prev]?.focus()
        }
        return
      }
      if (e.key === 'Escape') {
        // Dismiss suggestions only; prevent the document-level Escape from closing search.
        e.nativeEvent.stopImmediatePropagation()
        setShowSuggestions(false)
        setFocusedSugIdx(-1)
        return
      }
    }

    const items = resultsRef.current?.querySelectorAll<HTMLElement>('[data-result-item]')
    if (!items?.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(focusedIdx + 1, items.length - 1)
      setFocusedIdx(next)
      items[next]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (focusedIdx <= 0) {
        setFocusedIdx(-1)
        inputRef.current?.focus()
      } else {
        const prev = focusedIdx - 1
        setFocusedIdx(prev)
        items[prev]?.focus()
      }
    }
  }

  const blogCount  = results.filter(r => r.type === 'Blog').length
  const pageCount  = results.filter(r => r.type === 'Page').length
  const eventCount = results.filter(r => r.type === 'Event').length
  const allCount   = results.length

  const availableTopics = Array.from(new Set(
    results.filter(r => r.type === 'Blog' && r.topic).map(r => r.topic!)
  ))
  const showTopics = (typeFilter === 'all' || typeFilter === 'Blog') && availableTopics.length > 0

  const filteredResults = topicFilter
    ? results.filter(r => r.type !== 'Blog' || r.topic === topicFilter)
    : results

  const dur = (ms: number) => prefersReducedMotion ? 0 : ms / 1000

  const panelVariants = {
    hidden:  { y: '-100%' },
    visible: { y: 0,       transition: { duration: dur(380), ease: [0.16, 1, 0.3, 1] as const } },
    exit:    { y: '-100%', transition: { duration: dur(240), ease: [0.4, 0, 0.2, 1]  as const } },
  }

  const overlayVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: dur(200) } },
    exit:    { opacity: 0, transition: { duration: dur(150) } },
  }

  // ─── Filters drawer content ─────────────────────────────────────────────────
  // Shared between the immersive and compact panels — only one is ever mounted
  // at a time, so this is computed once and rendered inside the one FilterDrawer
  // instance near the bottom of the component.

  const activeFilterCount = (typeFilter !== 'all' ? 1 : 0) + (topicFilter ? 1 : 0)

  function countFor(f: TypeFilter) {
    if (f === 'all')   return allCount
    if (f === 'Blog')  return blogCount
    if (f === 'Event') return eventCount
    return pageCount
  }

  function clearAllFilters() {
    if (typeFilter !== 'all') handleTypeFilter('all')
    setTopicFilter(null)
  }

  // Returns an ARRAY, not a fragment — FilterDrawer stagger-reveals each direct
  // child individually, and a fragment would collapse to a single child slot.
  function FiltersPanelContent() {
    return [
        <FilterRadioGroup
          key="type"
          icon={Layers}
          heading="Type"
          ariaLabel={t('search.contentTypeFilter')}
          value={typeFilter}
          onSelect={handleTypeFilter}
          options={TYPE_FILTERS.map(f => ({
            value: f.value,
            label: f.label,
            count: hasSearched ? countFor(f.value) : undefined,
          }))}
        />,

        // Semantic search is a capability toggle, not a filter option — it stays
        // a switch, never a radio row, so it can't be mistaken for a 5th type.
        <div key="mode">
          <div className="mb-md flex items-center gap-sm text-fg">
            <Sparkles size={18} strokeWidth={2} aria-hidden className="text-brand" />
            <span className="text-body font-bold">Search mode</span>
          </div>
          <div className="flex items-center justify-between gap-md rounded-ot-control border border-fg/10 px-sm py-2.5">
            <span className="text-body text-fg">{semantic ? t('search.semanticOn') : t('search.semanticOff')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={semantic}
              aria-label="Enable AI semantic search"
              onClick={handleSemanticToggle}
              className={[
                'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-150 ease-quick',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                semantic ? 'border-accent bg-accent' : 'border-fg/20 bg-fg/10',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'absolute top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-canvas transition-transform duration-150 ease-quick',
                  semantic ? 'translate-x-[22px]' : 'translate-x-0.5',
                ].join(' ')}
              >
                {semantic && <Check size={11} strokeWidth={3} className="text-accent" />}
              </span>
            </button>
          </div>
        </div>,

        showTopics && (
          <FilterPillGroup
            key="topic"
            icon={Tag}
            heading="Topic"
            ariaLabel="Filter by topic"
            value={topicFilter}
            onSelect={v => setTopicFilter(topicFilter === v ? null : v)}
            options={availableTopics.map(topic => ({ value: topic as string | null, label: topic }))}
          />
        ),
    ].filter(Boolean)
  }

  // ─── Suggestion dropdown ───────────────────────────────────────────────────

  function SuggestionList({ compact: isCompact }: { compact: boolean }) {
    const groups = groupSuggestions(suggestions)
    let flatIndex = -1

    return (
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            key="suggestions-panel"
            role="listbox"
            aria-label="Suggested results"
            data-suggestions-list
            // Hovering in cancels the auto-close timer outright — stays open
            // for as long as the pointer is over it. The moment it leaves,
            // it collapses immediately (no restarted timer): a decisive,
            // physical dismiss instead of another arbitrary wait. The
            // chevron button next to the input brings it back without retyping.
            onMouseEnter={() => clearTimeout(suggestAutoCloseRef.current)}
            onMouseLeave={() => { setShowSuggestions(false); setFocusedSugIdx(-1) }}
            onKeyDown={e => {
              // Attached here (not just on the input) so Escape dismisses even
              // after arrow-key navigation has moved focus onto a row.
              if (e.key === 'Escape') {
                e.stopPropagation()
                setShowSuggestions(false)
                setFocusedSugIdx(-1)
                inputRef.current?.focus()
              }
            }}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: dur(100) } }}
            transition={{ duration: dur(180), ease: [0.16, 1, 0.3, 1] }}
            className={[
              'absolute top-full left-0 right-0 z-20 overflow-hidden max-h-[70vh] overflow-y-auto',
              'bg-canvas border border-fg/12 shadow-[0_12px_40px_oklch(0%_0_0/0.22)]',
              isCompact ? 'rounded-b-ot-surface mt-px' : 'rounded-ot-surface mt-xs',
            ].join(' ')}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.25 border-b border-fg/8">
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-accent px-sm py-1 text-[10px] uppercase tracking-[0.12em] font-bold text-fg-on-accent select-none">
                <Sparkles size={11} aria-hidden />
                Suggested results
              </span>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); setShowSuggestions(false); setFocusedSugIdx(-1) }}
                aria-label="Dismiss suggestions"
                className="text-fg-muted/60 hover:text-fg hover:bg-fg/8 transition-colors duration-100 p-1 -m-1 rounded-ot-control"
              >
                <X size={13} />
              </button>
            </div>
            {/* Groups */}
            {groups.map(group => {
              const { label: groupLabel, Icon: GroupIcon } = SUGGESTION_GROUP_META[group.type]
              return (
                <div key={group.type}>
                  <div className="flex items-center justify-between gap-sm px-3.5 pt-2.5 pb-1.5">
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] font-bold text-fg-muted/60 select-none">
                      <GroupIcon size={11} className="shrink-0" aria-hidden />
                      {groupLabel} ({group.items.length})
                    </span>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handleViewAllType(group.type) }}
                      className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-brand hover:text-brand-hover transition-colors"
                    >
                      View all →
                    </button>
                  </div>
                  <ul>
                    {group.items.map(item => {
                      flatIndex += 1
                      const i = flatIndex
                      return (
                        <li key={`${group.type}-${item.label}`} role="option" aria-selected={focusedSugIdx === i}>
                          <button
                            data-suggestion-item
                            type="button"
                            onMouseDown={e => { e.preventDefault(); handleSuggestionSelect(item) }}
                            className={[
                              'w-full text-left flex items-center gap-sm transition-colors duration-100',
                              'border-b border-fg/5',
                              isCompact ? 'px-3.5 py-2.5' : 'px-4.5 py-3.25',
                              focusedSugIdx === i
                                ? 'bg-brand/10'
                                : 'hover:bg-brand/6',
                            ].join(' ')}
                          >
                            <Search size={isCompact ? 11 : 13} className="shrink-0 text-fg-muted/30" aria-hidden />
                            <span className={`font-medium text-fg flex-1 truncate ${isCompact ? 'text-[13px]' : 'text-[15px]'}`}>
                              {highlightMatch(item.label, query)}
                            </span>
                            <span className="text-[10px] text-fg-muted/25 font-mono shrink-0 ml-sm select-none">
                              ↵
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // ─── Developer query flyout ────────────────────────────────────────────────

  function DevQueryPanel() {
    const url = lastSearchUrlRef.current
    const snippet = [
      '# API request',
      `GET ${url || '/api/search?q=<query>&type=all'}`,
      '',
      '# Graph strategy',
      `ordering:  ${semantic ? '_ranking: SEMANTIC  _semanticWeight: 0.8' : '_ranking: RELEVANCE'}`,
      `fulltext:  ${semantic ? 'match: $query' : 'match: $query, fuzzy: true, synonyms: ONE'}`,
      'pinning:   phrase-based (blogs, events, pages)',
      'scoping:   OT_ThemeManager.frontEndDomain',
    ].join('\n')

    const handleCopy = () => {
      navigator.clipboard.writeText(snippet).then(() => {
        setQueryCopied(true)
        setTimeout(() => setQueryCopied(false), 1800)
      })
    }

    return (
      <motion.div
        key="dev-flyout"
        initial={{ x: '100%' }}
        animate={{ x: 0, transition: { duration: dur(320), ease: [0.16, 1, 0.3, 1] } }}
        exit={{ x: '100%', transition: { duration: dur(220), ease: [0.4, 0, 1, 1] } }}
        className="absolute top-0 right-0 bottom-0 z-30 flex flex-col"
        style={{
          width: 'min(480px, calc(100% - 160px))',
          background: 'oklch(0.085 0.008 240)',
          borderLeft: '1px solid oklch(1 0 0 / 0.09)',
          boxShadow: '-20px 0 80px oklch(0 0 0 / 0.50)',
          fontFamily: 'var(--font-geist-mono, monospace)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-md py-sm shrink-0"
          style={{ borderBottom: '1px solid oklch(1 0 0 / 0.08)' }}
        >
          <div className="flex items-center gap-xs">
            <Code2 size={13} style={{ color: 'oklch(0.91 0.27 132)' }} aria-hidden />
            <span
              className="text-[11px] uppercase tracking-[0.14em] font-bold select-none"
              style={{ color: 'oklch(0.72 0.18 132)' }}
            >
              Query inspector
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowDevPanel(false)}
            aria-label="Close query inspector"
            className="opacity-40 hover:opacity-90 transition-opacity duration-150 p-1 rounded"
            style={{ color: 'oklch(0.72 0.01 250)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <pre
            className="px-md py-lg text-[14px] leading-[1.9] whitespace-pre-wrap break-all"
            style={{ color: 'oklch(0.72 0.01 250)' }}
          >
            <span style={{ color: 'oklch(0.40 0.01 250)' }}># API request{'\n'}</span>
            <span style={{ color: 'oklch(0.91 0.27 132)' }}>GET </span>
            <span style={{ color: 'oklch(0.82 0.01 250)' }}>{url || '/api/search?q=<query>&type=all'}</span>
            {'\n\n'}
            <span style={{ color: 'oklch(0.40 0.01 250)' }}># Graph strategy{'\n'}</span>
            <span style={{ color: 'oklch(0.55 0.01 250)' }}>ordering:  </span>
            <span style={{ color: semantic ? 'oklch(0.91 0.27 132)' : 'oklch(0.78 0.01 250)' }}>
              {semantic ? '_ranking: SEMANTIC  _semanticWeight: 0.8' : '_ranking: RELEVANCE'}
            </span>
            {'\n'}
            <span style={{ color: 'oklch(0.55 0.01 250)' }}>fulltext:  </span>
            <span style={{ color: 'oklch(0.78 0.01 250)' }}>
              {semantic ? 'match: $query' : 'match: $query, fuzzy: true, synonyms: ONE'}
            </span>
            {'\n'}
            <span style={{ color: 'oklch(0.55 0.01 250)' }}>pinning:   </span>
            <span style={{ color: 'oklch(0.78 0.01 250)' }}>phrase-based (blogs, events, pages)</span>
            {'\n'}
            <span style={{ color: 'oklch(0.55 0.01 250)' }}>scoping:   </span>
            <span style={{ color: 'oklch(0.78 0.01 250)' }}>OT_ThemeManager.frontEndDomain</span>
          </pre>
        </div>

        {/* Footer */}
        <div
          className="shrink-0 px-md py-sm flex items-center justify-end"
          style={{ borderTop: '1px solid oklch(1 0 0 / 0.08)' }}
        >
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy query details"
            className="text-[10px] uppercase tracking-widest font-bold px-md py-1.5 rounded-ot-control transition-all duration-150"
            style={{
              color:      queryCopied ? 'oklch(0.91 0.27 132)' : 'oklch(0.55 0.01 250)',
              background: queryCopied ? 'oklch(0.91 0.27 132 / 0.12)' : 'oklch(1 0 0 / 0.05)',
              border: '1px solid oklch(1 0 0 / 0.08)',
            }}
          >
            {queryCopied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </motion.div>
    )
  }

  // ─── Loading dots ──────────────────────────────────────────────────────────

  function LoadingDots() {
    return (
      <div className="flex items-center gap-xs py-lg" aria-label={t('search.searching')}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="block w-[5px] h-[5px] bg-brand/50 motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </div>
    )
  }

  // ─── Result item — list row ────────────────────────────────────────────────

  function ResultItem({ result, index, compact: isCompact }: {
    result:  SearchResult
    index:   number
    compact: boolean
  }) {
    const isEvent      = result.type === 'Event'
    const eventDate    = isEvent ? formatEventDate(result.startDate, result.endDate) : null
    const date         = isEvent ? eventDate : formatDate(result.published)
    const isFocused    = focusedIdx === index
    const hasThumbnail = !!result.imageUrl
    const crossOrigin  = mounted && isCrossOriginUrl(result.url)
    const hostLabel    = crossOrigin ? getHostLabel(result.url) : null

    const thumbSize = isCompact ? 'w-[48px] h-[48px]' : 'w-[68px] h-[68px]'

    return (
      <li key={result.id}>
        <button
          data-result-item
          tabIndex={isFocused ? 0 : -1}
          type="button"
          onClick={() => handleResultClick(result)}
          className={[
            'group w-full text-left flex items-start gap-md rounded-ot-surface',
            isCompact ? 'px-md py-[12px]' : 'py-[18px]',
            'border-b border-fg/8 last:border-0',
            'hover:bg-brand/5 focus-visible:outline-none focus-visible:bg-brand/5',
            'transition-colors duration-100',
            isFocused ? 'bg-brand/5' : '',
          ].join(' ')}
        >
          {/* Thumbnail */}
          <div className={`shrink-0 ${thumbSize} overflow-hidden rounded-ot-surface bg-surface/60 flex items-center justify-center mt-0.75`}>
            {hasThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.imageUrl!}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : isEvent ? (
              <CalendarDays size={isCompact ? 15 : 18} className="text-accent/40" />
            ) : result.type === 'Blog' ? (
              <Newspaper size={isCompact ? 15 : 18} className="text-fg-muted/25" />
            ) : (
              <FileText  size={isCompact ? 15 : 18} className="text-fg-muted/25" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[6px] flex-wrap mb-[5px]">
              <span className={`text-[10px] uppercase tracking-[0.1em] font-bold ${isEvent ? 'text-accent' : result.type === 'Blog' ? 'text-brand' : 'text-fg-muted/60'}`}>
                {result.type}
              </span>
              {isEvent && result.eventType && (
                <>
                  <span className="text-fg/15">·</span>
                  <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-fg-muted/55">
                    {eventTypeLabel(result.eventType)}
                  </span>
                </>
              )}
              {result.topic && (
                <>
                  <span className="text-fg/15">·</span>
                  <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-fg-muted/55">
                    {result.topic}
                  </span>
                </>
              )}
              {date && (
                <>
                  <span className="text-fg/15">·</span>
                  <span className={`text-[10px] ${isEvent ? 'text-fg-muted font-semibold inline-flex items-center gap-0.75' : 'text-fg-muted/40'}`}>
                    {isEvent && <CalendarDays size={11} strokeWidth={2} aria-hidden />}
                    {date}
                  </span>
                </>
              )}
              {hostLabel && (
                <>
                  <span className="text-fg/15">·</span>
                  <span className="inline-flex items-center gap-0.75 text-[10px] font-semibold text-fg-muted/50">
                    <ExternalLink size={9} aria-hidden />
                    {hostLabel}
                  </span>
                </>
              )}
            </div>

            <p className={[
              'font-semibold text-fg leading-snug line-clamp-2',
              'group-hover:text-brand group-focus-visible:text-brand transition-colors duration-150',
              isCompact ? 'text-[14px]' : 'text-[19px]',
            ].join(' ')}>
              {result.title}
            </p>

            {isEvent && result.locationLabel && (
              <p className={`mt-[4px] inline-flex items-center gap-[5px] font-medium text-fg-muted ${isCompact ? 'text-[12px]' : 'text-[13px]'}`}>
                {result.locationType === 'virtual'
                  ? <Video size={13} strokeWidth={2} className="text-fg-muted/70 shrink-0" aria-hidden />
                  : <MapPin size={13} strokeWidth={2} className="text-fg-muted/70 shrink-0" aria-hidden />}
                {result.locationLabel}
              </p>
            )}

            {result.excerpt && (
              <p className={`text-fg-muted leading-relaxed mt-[4px] line-clamp-2 ${isCompact ? 'text-[12px]' : 'text-[14px]'}`}>
                {result.excerpt}
              </p>
            )}
          </div>

          {/* Arrow (immersive only) */}
          {!isCompact && (
            <span
              aria-hidden
              className="shrink-0 self-center text-fg/15 group-hover:text-brand group-focus-visible:text-brand transition-colors text-base"
            >
              →
            </span>
          )}
        </button>
      </li>
    )
  }

  // ─── Result card — card grid view (immersive only) ─────────────────────────

  function ResultCard({ result, index }: { result: SearchResult; index: number }) {
    const isEvent    = result.type === 'Event'
    const date       = isEvent ? formatEventDate(result.startDate, result.endDate) : formatDate(result.published)
    const isFocused  = focusedIdx === index
    const crossOrigin = mounted && isCrossOriginUrl(result.url)
    const hostLabel   = crossOrigin ? getHostLabel(result.url) : null

    return (
      <li>
        <button
          data-result-item
          tabIndex={isFocused ? 0 : -1}
          type="button"
          onClick={() => handleResultClick(result)}
          className={[
            'group w-full text-left overflow-hidden rounded-ot-surface',
            'border border-fg/8',
            'hover:border-brand/30 hover:shadow-[0_4px_24px_var(--ot-bloom-brand-faint)]',
            'focus-visible:outline-none focus-visible:border-brand/40',
            'transition-all duration-200',
            isFocused ? 'border-brand/30 shadow-[0_4px_24px_var(--ot-bloom-brand-faint)]' : '',
          ].join(' ')}
        >
          {/* Thumbnail */}
          <div className="aspect-video w-full overflow-hidden bg-surface/60 flex items-center justify-center">
            {result.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.imageUrl}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {isEvent
                  ? <CalendarDays size={28} className="text-accent/25" />
                  : result.type === 'Blog'
                    ? <Newspaper size={28} className="text-fg-muted/18" />
                    : <FileText  size={28} className="text-fg-muted/18" />}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-md pt-md pb-lg">
            <div className="flex items-center gap-[6px] flex-wrap mb-[6px]">
              <span className={`text-[10px] uppercase tracking-[0.1em] font-bold ${isEvent ? 'text-accent' : result.type === 'Blog' ? 'text-brand' : 'text-fg-muted/60'}`}>
                {result.type}
              </span>
              {isEvent && result.eventType && (
                <>
                  <span className="text-fg/15">·</span>
                  <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-fg-muted/55">
                    {eventTypeLabel(result.eventType)}
                  </span>
                </>
              )}
              {result.topic && (
                <>
                  <span className="text-fg/15">·</span>
                  <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-fg-muted/55">
                    {result.topic}
                  </span>
                </>
              )}
              {hostLabel && (
                <>
                  <span className="text-fg/15">·</span>
                  <span className="inline-flex items-center gap-0.75 text-[10px] font-semibold text-fg-muted/50">
                    <ExternalLink size={9} aria-hidden />
                    {hostLabel}
                  </span>
                </>
              )}
            </div>
            <p className={[
              'font-semibold text-fg leading-snug line-clamp-3 text-[17px]',
              'group-hover:text-brand group-focus-visible:text-brand transition-colors duration-150',
            ].join(' ')}>
              {result.title}
            </p>
            {/* Event date + location carry as much weight as the title */}
            {isEvent && (date || result.locationLabel) && (
              <div className="mt-sm flex flex-col gap-[3px]">
                {date && (
                  <span className="inline-flex items-center gap-[5px] text-[12px] font-semibold text-fg-muted">
                    <CalendarDays size={13} strokeWidth={2} className="text-brand shrink-0" aria-hidden />
                    {date}
                  </span>
                )}
                {result.locationLabel && (
                  <span className="inline-flex items-center gap-[5px] text-[12px] text-fg-muted">
                    {result.locationType === 'virtual'
                      ? <Video size={13} strokeWidth={2} className="text-fg-muted/70 shrink-0" aria-hidden />
                      : <MapPin size={13} strokeWidth={2} className="text-fg-muted/70 shrink-0" aria-hidden />}
                    {result.locationLabel}
                  </span>
                )}
              </div>
            )}
            {result.excerpt && (
              <p className="text-fg-muted text-[13px] leading-relaxed mt-[6px] line-clamp-2">
                {result.excerpt}
              </p>
            )}
            {!isEvent && date && <p className="text-[10px] text-fg-muted/40 mt-sm">{date}</p>}
          </div>
        </button>
      </li>
    )
  }

  // ─── Immersive panel ───────────────────────────────────────────────────────

  function ImmersivePanel() {
    const resultCount = filteredResults.length
    const countLabel  = resultCount !== 1
      ? t('search.results', { count: String(resultCount) })
      : t('search.result')

    return (
      <div
        className="relative flex flex-col h-full overflow-hidden"
        style={{
          background: [
            'radial-gradient(ellipse 145% 58% at 50% -4%, oklch(from var(--ot-brand) l c h / 0.38) 0%, transparent 66%)',
            'var(--ot-canvas)',
          ].join(', '),
        }}
      >

        {/* Top bar — controls only, no search wordmark */}
        <div className="flex items-center justify-end px-md lg:px-2xl py-2.5 shrink-0 gap-sm">
          {/* Query inspector toggle — desktop/demo only */}
          <button
            type="button"
            onClick={() => setShowDevPanel(v => !v)}
            aria-label={showDevPanel ? 'Hide query inspector' : 'Show query inspector'}
            aria-pressed={showDevPanel}
            className={[
              'hidden md:flex items-center gap-1.25 px-sm h-9 rounded-ot-control transition-all duration-200',
              'focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2',
              showDevPanel
                ? 'bg-brand/15 text-brand ring-1 ring-brand/30'
                : 'text-fg-muted/50 bg-fg/7 ring-1 ring-fg/10 hover:text-fg hover:ring-fg/25 hover:bg-fg/10',
            ].join(' ')}
          >
            <Code2 size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Query</span>
          </button>
          <button
            type="button"
            onClick={toggleMode}
            aria-label={t('search.compact')}
            className="flex items-center gap-1.25 px-sm h-9 rounded-ot-control bg-brand text-fg-on-brand hover:opacity-90 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
          >
            <Minimize2 size={16} />
            <span className="text-[10px] uppercase tracking-[0.08em] font-semibold hidden sm:inline">Compact</span>
          </button>
          <button
            type="button"
            onClick={closeSearch}
            aria-label={t('search.close')}
            className="flex items-center justify-center w-9 h-9 text-fg-muted/60 hover:text-fg transition-all duration-150 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          ref={resultsRef as React.RefObject<HTMLDivElement>}
          id="search-results"
          role="region"
          aria-label={t('search.searchResults')}
          aria-live="polite"
          className="flex-1 overflow-y-auto"
        >
          <div className="px-md lg:px-2xl xl:px-[8vw] pt-lg pb-2xl">

            {/* /SEARCH wordmark */}
            <div className="mb-lg select-none" aria-hidden>
              <span
                className="font-display block leading-none"
                style={{
                  fontSize:              'clamp(4rem, 9vw, 9rem)',
                  letterSpacing:         '-0.045em',
                  fontVariationSettings: "'wght' 500",
                }}
              >
                <span className="text-brand">/</span><span className="text-fg">SEARCH</span>
              </span>
            </div>

            {/* Search input */}
            <label htmlFor="search-input-immersive" className="sr-only">{t('search.inputLabel')}</label>
            <div data-search-input-row className="relative flex items-center border-b-2 border-fg/15 focus-within:border-brand transition-colors duration-200 mb-lg">
              <Search size={18} className="shrink-0 text-fg-muted/40 mr-sm" aria-hidden />
              <input
                ref={inputRef}
                id="search-input-immersive"
                type="search"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => { if (!document.activeElement?.closest('[data-suggestions-list]')) { setShowSuggestions(false); setFocusedSugIdx(-1) } }, 200)}
                placeholder={t('search.placeholder')}
                autoComplete="off"
                spellCheck={false}
                aria-label={t('search.inputLabel')}
                aria-controls="search-results"
                aria-autocomplete="list"
                aria-expanded={showSuggestions}
                className={[
                  'flex-1 bg-transparent text-fg py-sm outline-none',
                  'text-[1.1rem] font-medium placeholder:text-fg-muted/30',
                  '[&::-webkit-search-cancel-button]:hidden',
                ].join(' ')}
              />
              {suggestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSuggestions(v => !v)}
                  aria-label={showSuggestions ? 'Hide suggestions' : 'Show suggestions'}
                  aria-expanded={showSuggestions}
                  className="shrink-0 p-xs text-fg-muted/40 hover:text-fg transition-colors"
                >
                  <ChevronDown size={15} className={`transition-transform duration-150 ${showSuggestions ? 'rotate-180' : ''}`} />
                </button>
              )}
              {query && (
                <button
                  type="button"
                  onClick={() => handleQueryChange('')}
                  aria-label={t('search.clearFilter')}
                  className="shrink-0 p-xs text-fg-muted/40 hover:text-fg transition-colors"
                >
                  <X size={13} />
                </button>
              )}
              {SuggestionList({ compact: false })}
            </div>

            {/* Filters trigger — opens the shared left-anchored filter drawer */}
            <div className="mb-md flex items-center justify-between gap-md">
              <FilterTriggerButton
                ref={filterTriggerRef}
                open={filtersOpen}
                onClick={() => setFiltersOpen(v => !v)}
                activeCount={activeFilterCount}
                panelId={filterPanelId}
              />

              {/* List / card view toggle */}
              <div className="flex items-center gap-[2px] shrink-0" role="group" aria-label="View mode">
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                  className={[
                    'p-[7px] rounded-full transition-colors duration-150',
                    'focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1',
                    viewMode === 'list'
                      ? 'text-brand bg-brand/10'
                      : 'text-fg-muted/40 hover:text-fg-muted hover:bg-fg/6',
                  ].join(' ')}
                >
                  <List size={16} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label="Card view"
                  aria-pressed={viewMode === 'card'}
                  onClick={() => setViewMode('card')}
                  className={[
                    'p-[7px] rounded-full transition-colors duration-150',
                    'focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1',
                    viewMode === 'card'
                      ? 'text-brand bg-brand/10'
                      : 'text-fg-muted/40 hover:text-fg-muted hover:bg-fg/6',
                  ].join(' ')}
                >
                  <LayoutGrid size={16} strokeWidth={1.75} />
                </button>
              </div>
            </div>


            {/* Loading */}
            {loading && LoadingDots()}

            {/* No results */}
            {!loading && hasSearched && filteredResults.length === 0 && (
              <div className="py-md">
                <p className="text-[1.25rem] font-semibold text-fg/60">
                  {t('search.noResults', { query })}
                </p>
                <p className="text-[11px] uppercase tracking-[0.1em] text-fg-muted/35 mt-xs">
                  {t('search.noResultsHint')}
                </p>
              </div>
            )}

            {/* Results */}
            {!loading && filteredResults.length > 0 && (
              <>
                <p className="text-[11px] uppercase tracking-[0.1em] text-fg-muted/35 mb-md">
                  {countLabel}
                  {semantic && (
                    <span className="ml-sm text-accent/70"> · {t('search.aiRanked')}</span>
                  )}
                </p>
                {viewMode === 'list' ? (
                  <ul>
                    {filteredResults.map((result, i) =>
                      ResultItem({ result, index: i, compact: false })
                    )}
                  </ul>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                    {filteredResults.map((result, i) =>
                      ResultCard({ result, index: i })
                    )}
                  </ul>
                )}
              </>
            )}

          </div>
        </div>

        {/* Query inspector flyout — slides in from right edge */}
        <AnimatePresence>
          {showDevPanel && DevQueryPanel()}
        </AnimatePresence>
      </div>
    )
  }

  // ─── Compact HUD panel ─────────────────────────────────────────────────────

  function CompactPanel() {
    return (
      <div
        className="flex flex-col overflow-hidden border-b border-fg/8 shadow-[0_12px_48px_oklch(0%_0_0_/_0.28)]"
        style={{
          maxHeight: '70vh',
          background: 'radial-gradient(ellipse at 88% 0%, oklch(from var(--ot-brand) l c h / 0.16) 0%, transparent 52%), var(--ot-surface)',
        }}
      >

        {/* Header row — brand bar indicator replaces hollow wordmark */}
        <div className="flex items-center justify-between px-md pt-[14px] pb-[10px] border-b border-fg/8 shrink-0">
          <div className="flex items-center gap-[8px]" aria-hidden>
            <span className="block w-[3px] h-[16px] bg-brand rounded-full" />
            <span className="text-[11px] uppercase tracking-[0.13em] font-bold text-fg-muted/45 select-none">
              SEARCH
            </span>
          </div>
          <div className="flex items-center gap-[2px]">
            <button
              type="button"
              onClick={toggleMode}
              aria-label={t('search.expand')}
              className="p-[7px] text-fg-muted/45 hover:text-fg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <Maximize2 size={14} />
            </button>
            <button
              type="button"
              onClick={closeSearch}
              aria-label={t('search.close')}
              className="p-[7px] text-fg-muted/45 hover:text-fg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Input area — visually boxed so it reads as a text field, not a label row */}
        <div className="px-md pt-[8px] pb-[10px] border-b border-fg/8 shrink-0">
          <label htmlFor="search-input-compact" className="sr-only">{t('search.inputLabel')}</label>
          <div className="relative">
            <div data-search-input-row className="flex items-center gap-[8px] rounded-ot-control border border-fg/18 bg-fg/5 shadow-[inset_0_1px_3px_oklch(from_var(--ot-fg)_l_c_h/0.12),inset_0_-1px_0_oklch(from_var(--ot-fg)_l_c_h/0.04)] focus-within:border-brand/55 focus-within:bg-brand/5 focus-within:shadow-[inset_0_1px_4px_oklch(from_var(--ot-fg)_l_c_h/0.18),0_0_0_3px_var(--ot-bloom-brand-border)] px-2.5 py-2.25 transition-[border-color,background-color,box-shadow] duration-150">
              <Search size={14} className="shrink-0 text-fg-muted/45" aria-hidden />
              <input
                ref={inputRef}
                id="search-input-compact"
                type="search"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => { if (!document.activeElement?.closest('[data-suggestions-list]')) { setShowSuggestions(false); setFocusedSugIdx(-1) } }, 200)}
                placeholder={t('search.placeholderCompact')}
                autoComplete="off"
                spellCheck={false}
                aria-label={t('search.inputLabel')}
                aria-controls="search-results-compact"
                aria-autocomplete="list"
                aria-expanded={showSuggestions}
                className={[
                  'flex-1 bg-transparent text-fg placeholder:text-fg-muted/35',
                  'text-[14px] font-medium outline-none leading-none',
                  '[&::-webkit-search-cancel-button]:hidden',
                ].join(' ')}
              />
              {suggestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSuggestions(v => !v)}
                  aria-label={showSuggestions ? 'Hide suggestions' : 'Show suggestions'}
                  aria-expanded={showSuggestions}
                  className="shrink-0 p-[3px] text-fg-muted/40 hover:text-fg transition-colors"
                >
                  <ChevronDown size={13} className={`transition-transform duration-150 ${showSuggestions ? 'rotate-180' : ''}`} />
                </button>
              )}
              {query && (
                <button
                  type="button"
                  onClick={() => handleQueryChange('')}
                  aria-label={t('search.clearFilter')}
                  className="shrink-0 p-[3px] text-fg-muted/40 hover:text-fg transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {SuggestionList({ compact: true })}
          </div>
        </div>

        {/* Filters trigger — opens the shared left-anchored filter drawer */}
        <div className="px-md py-sm border-b border-fg/8 shrink-0">
          <FilterTriggerButton
            ref={filterTriggerRef}
            open={filtersOpen}
            onClick={() => setFiltersOpen(v => !v)}
            activeCount={activeFilterCount}
            panelId={filterPanelId}
          />
        </div>

        {/* Results */}
        <div
          id="search-results-compact"
          role="region"
          aria-label={t('search.searchResults')}
          aria-live="polite"
          className="overflow-y-auto flex-1"
        >
          {loading && (
            <div className="px-md">
              {LoadingDots()}
            </div>
          )}


          {!loading && hasSearched && filteredResults.length === 0 && (
            <p className="px-md py-md text-[14px] font-medium text-fg-muted/60">
              {t('search.noResults', { query })}
            </p>
          )}

          {!loading && filteredResults.length > 0 && (
            <div ref={resultsRef as React.RefObject<HTMLDivElement>}>
              <ul>
                {filteredResults.map((result, i) =>
                  ResultItem({ result, index: i, compact: true })
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Portal ────────────────────────────────────────────────────────────────

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for compact mode */}
          {mode === 'compact' && (
            <motion.div
              key="overlay"
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              aria-hidden
              onClick={closeSearch}
              className="fixed inset-0 z-[48] bg-canvas/65 backdrop-blur-[2px]"
            />
          )}

          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('search.siteSearch')}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={
              mode === 'immersive'
                ? 'fixed inset-0 z-[60] bg-canvas flex flex-col'
                : 'search-compact-panel fixed left-0 right-0 top-20 z-[49] flex flex-col'
            }
          >
            {mode === 'immersive' ? ImmersivePanel() : CompactPanel()}
          </motion.div>

          <FilterDrawer
            id={filterPanelId}
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            activeCount={activeFilterCount}
            onClearAll={clearAllFilters}
            triggerRef={filterTriggerRef}
          >
            {FiltersPanelContent()}
          </FilterDrawer>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
