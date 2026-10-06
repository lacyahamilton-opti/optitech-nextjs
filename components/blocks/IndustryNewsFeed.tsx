import { useId } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEFAULT_FEED_LAYOUT, type FeedLayout } from '@/lib/feeds/layouts'
import { formatFeedDate } from '@/lib/feeds/format'
import type { FeedItem, FeedResult } from '@/lib/feeds/types'
import FeedImage from './IndustryNewsFeed.client'

/**
 * IndustryNewsFeed — pure presentational list of external feed items.
 * All feed text is rendered as React text (no raw-HTML sinks).
 *
 * RESTYLE HOOKS (for /impeccable craft): every element carries a `data-*` hook
 * and its classes come from `layoutStyles[layout]`. Add a layout by adding a
 * value to `layoutOptions` (lib/feeds/layouts.ts) + one entry below.
 *   section  [data-layout] [data-color]
 *   article  [data-feed-item] [data-has-image]
 *   parts    data-feed-heading | -list | -image | -body | -title | -summary | -meta | -date | -source | -state
 */

export type IndustryNewsFeedProps = {
  heading?:      string
  /** Semantic heading level, 2–4 */
  headingLevel?: 2 | 3 | 4
  result:        FeedResult
  layout?:       FeedLayout
  color?:        'canvas' | 'surface'
  showImage?:    boolean
  showDate?:     boolean
  showSummary?:  boolean
  showSource?:   boolean
  locale?:       string
  /** Preview-attribute factory from getPreviewUtils (server context only) */
  pa?:           (prop: string) => Record<string, unknown>
}

type LayoutStyles = {
  section: string; inner: string; heading: string; list: string; item: string
  imageFrame: string; image: string; body: string
  title: string; link: string; summary: string; meta: string; state: string
  /** Trailing external-link indicator (aria-hidden; the link carries the sr-only hint) */
  arrow: string
  /** Source attribution pill (footer link): accent in dark mode, brand in light mode */
  pill: string
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm'

// `default` mirrors the Blog Feed's list mode: bordered rounded rows, small
// left thumbnail, headline + meta, trailing external-link arrow. The headline
// link is stretched (after:inset-0) so the whole row is the click target.
const layoutStyles: Record<FeedLayout, LayoutStyles> = {
  default: {
    section:    'px-md py-xl lg:px-lg',
    inner:      'mx-auto max-w-7xl',
    heading:    'text-headline font-bold tracking-headline leading-headline text-fg mb-xl text-balance',
    list:       'm-0 p-0 list-none flex flex-col gap-sm',
    item: [
      'group relative flex items-center gap-md p-sm sm:p-md rounded-ot-surface border border-fg/8',
      'hover:border-brand/50 hover:bg-brand/4 transition-colors duration-150 ease-quick',
      'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand',
      'break-inside-avoid',
    ].join(' '),
    imageFrame: 'shrink-0 w-24 sm:w-32 aspect-video overflow-hidden rounded-ot-surface bg-surface',
    image:      'h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]',
    body:       'flex-1 min-w-0 flex flex-col gap-xs',
    title:      'text-title leading-title font-semibold text-balance text-fg m-0',
    link:       'outline-none after:absolute after:inset-0 after:content-[\'\'] group-hover:underline decoration-fg/20 underline-offset-2',
    summary:    'text-body leading-body text-fg-muted m-0 line-clamp-2',
    meta:       'text-label text-fg-muted m-0',
    state:      'text-body leading-body text-fg-muted m-0',
    arrow:      'flex items-center justify-center shrink-0 size-9 rounded-full border border-brand/50 bg-brand/10 text-brand group-hover:bg-brand group-hover:text-fg-on-brand motion-safe:transition-colors motion-safe:duration-150',
    pill:       'inline-flex w-fit items-center rounded-full px-sm py-1 text-label font-semibold uppercase tracking-label bg-accent text-fg-on-accent [[data-theme=light]_&]:bg-brand [[data-theme=light]_&]:text-fg-on-brand',
  },
}

const plainLink = `underline decoration-fg/30 underline-offset-4 hover:decoration-current ${focusRing}`

const SR_NEW_TAB = ' (opens in a new tab)'

function ExternalAnchor({ href, className, children, icon = true }: { href: string; className: string; children: React.ReactNode; icon?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      {icon && <ExternalLink aria-hidden="true" className="inline-block size-[0.8em] ml-1 align-baseline" />}
      <span className="sr-only">{SR_NEW_TAB}</span>
    </a>
  )
}

function FeedItemView({ item, s, itemLevel, showImage, showDate, showSummary, locale }: {
  item: FeedItem; s: LayoutStyles; itemLevel: 3 | 4 | 5
  showImage: boolean; showDate: boolean; showSummary: boolean; locale?: string
}) {
  const ItemHeading = `h${itemLevel}` as 'h3' | 'h4' | 'h5'
  const hasImage = !!item.image
  const date = showDate ? formatFeedDate(item.date, item.dateOnly, locale) : ''
  return (
    <li>
      <article className={s.item} data-feed-item data-has-image={hasImage ? 'true' : 'false'}>
        {showImage && item.image && (
          <FeedImage src={item.image.url} frameClassName={s.imageFrame} imgClassName={s.image} />
        )}
        <div className={s.body} data-feed-body>
          <ItemHeading className={s.title} data-feed-title>
            <ExternalAnchor href={item.link} className={s.link} icon={false}>{item.title}</ExternalAnchor>
          </ItemHeading>
          {showSummary && item.summary && <p className={s.summary} data-feed-summary>{item.summary}</p>}
          {date && item.date && (
            <p className={s.meta} data-feed-meta>
              <time dateTime={item.date} data-feed-date>{date}</time>
            </p>
          )}
        </div>
        <div className={s.arrow} aria-hidden="true" data-feed-arrow>
          <ExternalLink size={18} strokeWidth={2.25} />
        </div>
      </article>
    </li>
  )
}

export default function IndustryNewsFeed({
  heading, headingLevel = 2, result, layout = DEFAULT_FEED_LAYOUT, color = 'canvas',
  showImage = true, showDate = true, showSummary = true, showSource = true, locale, pa,
}: IndustryNewsFeedProps) {
  const headingId = useId()
  const s = layoutStyles[layout] ?? layoutStyles[DEFAULT_FEED_LAYOUT]
  const source = result.status === 'ok' ? result.payload.source : result.source
  const items  = result.status === 'ok' ? result.payload.items : []
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  const itemLevel = Math.min(headingLevel + 1, 5) as 3 | 4 | 5

  return (
    <section
      className={cn(s.section, color === 'surface' ? 'bg-surface' : 'bg-canvas')}
      data-layout={layout}
      data-color={color}
      aria-labelledby={heading ? headingId : undefined}
      aria-label={heading ? undefined : `${source.label} news`}
    >
      <div className={s.inner}>
      {heading && (
        <Heading id={headingId} className={s.heading} data-feed-heading {...(pa?.('heading') ?? {})}>{heading}</Heading>
      )}

      {result.status === 'unavailable' && (
        <p role="status" className={s.state} data-feed-state="unavailable">
          News is temporarily unavailable.{' '}
          <ExternalAnchor href={source.homepage} className={plainLink}>Visit {source.name}</ExternalAnchor>
        </p>
      )}

      {result.status === 'ok' && items.length === 0 && (
        <p role="status" className={s.state} data-feed-state="empty">No recent stories</p>
      )}

      {items.length > 0 && (
        <ul className={s.list} data-feed-list>
          {items.map(item => (
            <FeedItemView
              key={item.id}
              item={item} s={s} itemLevel={itemLevel} locale={locale}
              showImage={showImage} showDate={showDate} showSummary={showSummary}
            />
          ))}
        </ul>
      )}

      {showSource && (
        <p className={cn(s.meta, 'mt-md')} data-feed-source>
          Source:{' '}
          <ExternalAnchor href={source.homepage} className={`${s.pill} ${focusRing} ml-1 gap-1 no-underline`}>
            <span data-feed-pill>{source.name}</span>
          </ExternalAnchor>
        </p>
      )}
      </div>
    </section>
  )
}
