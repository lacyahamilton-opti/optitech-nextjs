'use client'

import { useState, useMemo, useCallback, useEffect, useId, useRef } from 'react'
import { LayoutGrid, List, ChevronRight, ExternalLink, Tag } from 'lucide-react'
import type { BlogFeedPost } from '@/lib/blogFeed'
import Pagination from '@/components/ui/Pagination'
import { FilterTriggerButton, FilterDrawer, FilterPillGroup } from '@/components/ui/FilterDrawer'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPIC_LABELS: Record<string, string> = {
  news:       'News',
  insights:   'Insights',
  leadership: 'Leadership',
  stories:    'Stories',
  innovation: 'Innovation',
  culture:    'Culture',
  events:     'Events',
  resources:  'Resources',
}

function topicLabel(t: string): string {
  return TOPIC_LABELS[t] ?? t.charAt(0).toUpperCase() + t.slice(1)
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(iso))
  } catch { return '' }
}

// ─── Cross-domain detection ────────────────────────────────────────────────────

function isExternalUrl(url: string, mounted: boolean): boolean {
  if (!mounted || !url.startsWith('http')) return false
  try { return new URL(url).origin !== window.location.origin }
  catch { return false }
}

// ─── TopicPill ────────────────────────────────────────────────────────────────
// The solid accent-fill badge already established for editorial category labels
// (see the Hero Spotlight eyebrow and StoryRailSlide's corner tag) — a deliberate
// exception to the system's sharp-corner default, reserved for this one kind of
// label. Fixed fill + fixed on-accent text, so it reads the same on any
// background (canvas, brand panel, or image) without a conditional per view.

function TopicPill({ label }: { label: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-accent px-sm py-1 text-label font-semibold uppercase tracking-label text-fg-on-accent">
      {label}
    </span>
  )
}

// ─── BlogCard ─────────────────────────────────────────────────────────────────

function BlogCard({ post, onBrand, mounted }: { post: BlogFeedPost; onBrand: boolean; mounted: boolean }) {
  const imageUrl  = post.featuredImage?.url?.default
  const postUrl   = post._metadata?.url?.default ?? '#'
  const published = post._metadata?.published
  const topic     = post.topic
  const author    = post.authorRef?.name
  const external  = isExternalUrl(postUrl, mounted)

  return (
    <a
      href={postUrl}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={`group block rounded-ot-surface overflow-hidden card-hover-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        onBrand ? 'bg-fg/8 border border-fg-on-brand/15' : 'bg-canvas border border-fg/8'
      }`}
    >
      {/* Thumbnail */}
      <div className="aspect-video overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={post.headline}
            loading="lazy"
            className="w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-brand/25 to-canvas" />
        )}
      </div>

      {/* Body */}
      <div className="px-md pt-md pb-lg">
        {topic && (
          <div className="mb-sm">
            <TopicPill label={topicLabel(topic)} />
          </div>
        )}
        <h3 className={`text-title leading-title font-semibold text-balance line-clamp-3 ${
          onBrand ? 'text-fg-on-brand' : 'text-fg'
        }`}>
          {post.headline}
        </h3>
        <div className={`mt-sm flex flex-wrap items-center gap-x-sm gap-y-xs text-label ${
          onBrand ? 'text-fg-on-brand/60' : 'text-fg-muted'
        }`}>
          {author && <span>{author}</span>}
          {author && published && <span aria-hidden>·</span>}
          {published && <time dateTime={published}>{formatDate(published)}</time>}
          {post.readTime && <><span aria-hidden>·</span><span>{post.readTime}</span></>}
          {external && (
            <span className="inline-flex items-center gap-0.75 ml-auto" aria-label="Opens in a new tab">
              <ExternalLink size={11} className={onBrand ? 'text-fg-on-brand/40' : 'text-fg-muted/40'} />
            </span>
          )}
        </div>
      </div>
    </a>
  )
}

// ─── BlogListRow ──────────────────────────────────────────────────────────────

function BlogListRow({ post, onBrand, mounted }: { post: BlogFeedPost; onBrand: boolean; mounted: boolean }) {
  const imageUrl  = post.featuredImage?.url?.default
  const postUrl   = post._metadata?.url?.default ?? '#'
  const published = post._metadata?.published
  const topic     = post.topic
  const author    = post.authorRef?.name
  const external  = isExternalUrl(postUrl, mounted)

  const borderClass   = onBrand ? 'border-fg-on-brand/12'  : 'border-fg/8'
  const hoverClass    = onBrand ? 'hover:border-fg-on-brand/35 hover:bg-fg/6' : 'hover:border-brand/50 hover:bg-brand/4'
  const headlineClass = onBrand ? 'text-fg-on-brand'       : 'text-fg'
  const metaClass     = onBrand ? 'text-fg-on-brand/55'    : 'text-fg-muted'
  const arrowClass    = onBrand ? 'text-fg-on-brand/40 group-hover:text-fg-on-brand' : 'text-fg-muted/40 group-hover:text-brand'

  return (
    <a
      href={postUrl}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={`group flex items-center gap-md p-sm sm:p-md rounded-ot-surface border ${borderClass} ${hoverClass}
        transition-colors duration-150 ease-quick
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
    >
      {/* Thumbnail — only rendered when a featured image is set */}
      {imageUrl && (
        <div className="shrink-0 w-20 h-14 sm:w-28 sm:h-18 overflow-hidden rounded-ot-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className="w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
        </div>
      )}

      {/* Content — topic pill sits directly above the headline it labels, at
          every breakpoint, instead of a separate desktop column disconnected
          from the copy it describes. */}
      <div className="flex-1 min-w-0">
        {topic && (
          <div className="mb-xs">
            <TopicPill label={topicLabel(topic)} />
          </div>
        )}
        <h3 className={`text-title leading-title font-semibold text-balance group-hover:underline decoration-fg/20 underline-offset-2 ${headlineClass}`}>
          {post.headline}
        </h3>
        <div className={`mt-xs flex flex-wrap items-center gap-x-sm gap-y-xs text-label ${metaClass}`}>
          {author && <span>{author}</span>}
          {author && published && <span aria-hidden>·</span>}
          {published && <time dateTime={published}>{formatDate(published)}</time>}
          {post.readTime && <><span aria-hidden>·</span><span>{post.readTime}</span></>}
        </div>
      </div>

      {/* Arrow / external indicator */}
      <div className={`hidden sm:flex items-center shrink-0 transition-transform duration-150 group-hover:translate-x-1 ${arrowClass}`}
           aria-label={external ? 'Opens in a new tab' : undefined}>
        {external
          ? <ExternalLink size={16} strokeWidth={1.75} />
          : <ChevronRight size={18} strokeWidth={1.75} />
        }
      </div>
    </a>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onBrand, filtered }: { onBrand: boolean; filtered: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center py-2xl gap-md ${
      onBrand ? 'text-fg-on-brand/55' : 'text-fg-muted'
    }`}>
      <div className={`w-12 h-12 border-2 flex items-center justify-center ${
        onBrand ? 'border-fg-on-brand/20' : 'border-fg/12'
      }`}>
        <List size={20} strokeWidth={1.5} />
      </div>
      <p className="text-body">
        {filtered ? 'No posts match this topic.' : 'No posts found.'}
      </p>
    </div>
  )
}

// ─── BlogFeedClient ───────────────────────────────────────────────────────────

export type BlogFeedClientProps = {
  posts:    BlogFeedPost[]
  topics:   string[]
  /** Max posts per paginated page — defaults to 9 */
  pageSize: number
  /**
   * When the CMS editor has locked the feed to a single topic, this prop
   * carries that value. Posts are already filtered server-side; this flag
   * suppresses the topic chip UI so visitors cannot override the editor's intent.
   */
  topicFilter?: string | null
  /** Grid column count in card view: 2 or 3 */
  columns:     2 | 3
  /** True when the parent section has brand background (adjusts chip/text colours) */
  onBrand:     boolean
  /** ID of the anchor element above the feed for scroll-on-page-change */
  anchorId:    string
  /** Initial view mode — set by the CMS editor; visitor can still toggle */
  defaultView?: 'grid' | 'list'
  /** True for any CMS draft/preview render — hides the filter trigger + drawer. */
  isPreview?:   boolean
}

type View = 'grid' | 'list'

export default function BlogFeedClient({
  posts,
  topics,
  pageSize,
  topicFilter = null,
  columns,
  onBrand,
  anchorId,
  defaultView = 'grid',
  isPreview   = false,
}: BlogFeedClientProps) {
  const [view,        setView]   = useState<View>(defaultView)
  const [activeTopic, setTopic]  = useState<string | null>(null)
  const [page,        setPage]   = useState(1)
  const [mounted,     setMounted] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const prefersReducedMotion      = usePrefersReducedMotion()
  const filterTriggerRef = useRef<HTMLButtonElement>(null)
  const filterPanelId    = useId()

  useEffect(() => { setMounted(true) }, [])

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(
    () => activeTopic ? posts.filter(p => p.topic === activeTopic) : posts,
    [posts, activeTopic],
  )

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const pagePosts  = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const changeTopic = useCallback((t: string | null) => {
    setTopic(t)
    setPage(1)
  }, [])

  const changePage = useCallback((p: number) => {
    setPage(p)
    // Scroll to the feed heading anchor — honour prefers-reduced-motion (the CSS
    // animations are motion-safe gated; this JS-driven scroll must be too).
    document.getElementById(anchorId)?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' })
  }, [anchorId, prefersReducedMotion])

  // ── Styles ─────────────────────────────────────────────────────────────────
  const gridClass = columns === 2
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-lg'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg'

  const toggleBase = `inline-flex items-center justify-center w-11 h-11 rounded-ot-control transition-colors duration-150 ease-quick focus-visible:outline-2 focus-visible:outline-offset-2 ${onBrand ? 'focus-visible:outline-fg-on-brand' : 'focus-visible:outline-brand'}`

  const toggleActive   = onBrand ? 'text-fg-on-brand' : 'text-brand'
  const toggleInactive = onBrand ? 'text-fg-on-brand/40 hover:text-fg-on-brand/70' : 'text-fg-muted/50 hover:text-fg-muted'

  const dividerClass = onBrand ? 'border-fg-on-brand/12' : 'border-fg/8'

  return (
    <div>
      {/* ── Controls bar ────────────────────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center justify-between gap-sm pb-lg mb-lg border-b ${dividerClass}`}>

        {/* Filters trigger — hidden when the CMS has locked the feed to a single topic,
            and hidden entirely in CMS preview/edit renders (live-front-end feature only) */}
        {!topicFilter && !isPreview && (
          <FilterTriggerButton
            ref={filterTriggerRef}
            open={filtersOpen}
            onClick={() => setFiltersOpen(v => !v)}
            activeCount={activeTopic ? 1 : 0}
            panelId={filterPanelId}
          />
        )}
        {/* When topic-locked: show the active topic as a static label */}
        {topicFilter && (
          <p className={`text-label tracking-label uppercase font-semibold ${onBrand ? 'text-fg-on-brand/60' : 'text-fg-muted'}`}>
            {topicLabel(topicFilter)}
          </p>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-0.5" role="group" aria-label="View mode">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
            className={`${toggleBase} ${view === 'grid' ? toggleActive : toggleInactive}`}
          >
            <LayoutGrid size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={`${toggleBase} ${view === 'list' ? toggleActive : toggleInactive}`}
          >
            <List size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Filter drawer — same gating as the trigger above */}
      {!topicFilter && !isPreview && (
        <FilterDrawer
          id={filterPanelId}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          activeCount={activeTopic ? 1 : 0}
          onClearAll={() => changeTopic(null)}
          triggerRef={filterTriggerRef}
        >
          <FilterPillGroup
            icon={Tag}
            heading="Topic"
            ariaLabel="Filter by topic"
            value={activeTopic}
            onSelect={v => changeTopic(activeTopic === v ? null : v)}
            options={topics.map(t => ({ value: t as string | null, label: topicLabel(t) }))}
          />
        </FilterDrawer>
      )}

      {/* ── Posts ───────────────────────────────────────────────────────────── */}
      {/* Keyed on the active topic so a filter change fades the swapped-in set
          in, instead of the list silently replacing itself mid-scroll. */}
      <div key={activeTopic ?? 'all'} className="animate-filter-swap">
        {pagePosts.length === 0 ? (
          <EmptyState onBrand={onBrand} filtered={activeTopic !== null} />
        ) : view === 'grid' ? (
          <div className={gridClass}>
            {pagePosts.map(post => (
              <BlogCard key={post._metadata.key} post={post} onBrand={onBrand} mounted={mounted} />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-sm">
            {pagePosts.map(post => (
              <li key={post._metadata.key}>
                <BlogListRow post={post} onBrand={onBrand} mounted={mounted} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        total={filtered.length}
        pageSize={pageSize}
        countLabel="posts"
        onBrand={onBrand}
        onChange={changePage}
      />
    </div>
  )
}
