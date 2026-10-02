import { XMLParser } from 'fast-xml-parser'
import { cleanText, decodeEntities, toRawHtml, truncateWords } from './text'
import { parseFeedDate, type ParsedDate } from './date'
import type { FeedItem } from './types'

export const MAX_ITEMS = 12

export type NormalizeResult = {
  format:   'rss' | 'atom' | 'unknown'
  items:    FeedItem[]
  warnings: string[]
}

// Entity processing is OFF: no DTD/entity expansion can occur (billion-laughs
// and XXE are structurally impossible). Entities are decoded by text.ts instead.
const parser = new XMLParser({
  ignoreAttributes:    false,
  attributeNamePrefix: '@_',
  processEntities:     false,
  htmlEntities:        false,
  parseTagValue:       false,
  parseAttributeValue: false,
  trimValues:          true,
  isArray: (name) => ['item', 'entry', 'link', 'enclosure', 'media:content', 'media:thumbnail', 'media:group'].includes(name),
})

type Node = Record<string, unknown>

const isObj = (v: unknown): v is Node => typeof v === 'object' && v !== null && !Array.isArray(v)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v])

/** Raw text of a node (string, number, or `{ '#text': … }`). */
function rawText(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return rawText(v[0])
  if (isObj(v)) return typeof v['#text'] === 'string' ? (v['#text'] as string) : ''
  return ''
}

const attr = (n: unknown, name: string): string =>
  isObj(n) && typeof n[`@_${name}`] === 'string' ? (n[`@_${name}`] as string) : ''

/** http(s) only, no credentials, utm_* stripped. Returns null when unusable. */
export function sanitizeLink(raw: string): string | null {
  const s = decodeEntities(raw).trim()
  if (!s || s.length > 2048) return null
  let u: URL
  try { u = new URL(s) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k)) u.searchParams.delete(k)
  return u.toString()
}

function sanitizeImageUrl(raw: string): string | null {
  const s = decodeEntities(raw).trim()
  if (!s || s.length > 2048) return null
  let u: URL
  try { u = new URL(s) } catch { return null }
  if (u.protocol !== 'https:' || u.username || u.password) return null
  return u.toString()
}

const IMG_EXT = /\.(?:jpe?g|png|gif|webp|avif)(?:$|[?#])/i

function mediaImage(nodes: unknown[]): string | null {
  for (const n of nodes) {
    const url = attr(n, 'url')
    if (!url) continue
    const type = attr(n, 'type').toLowerCase()
    const medium = attr(n, 'medium').toLowerCase()
    const ok = type.startsWith('image/') || medium === 'image' || (!type && !medium && IMG_EXT.test(url))
    if (!ok) continue
    const safe = sanitizeImageUrl(url)
    if (safe) return safe
  }
  return null
}

function firstImgSrc(rawHtml: string): string | null {
  const re = /<img\b([^>]*)>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(rawHtml))) {
    const tag = m[1]
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag)
    if (!src) continue
    if (/\b(?:width|height)\s*=\s*["']?[012]["']?(?:\s|\/|$)/i.test(tag)) continue // tracking pixel
    const safe = sanitizeImageUrl(src[1] ?? src[2] ?? '')
    if (safe) return safe
  }
  return null
}

function extractImage(item: Node, htmlSources: string[]): string | null {
  const groups = arr(item['media:group']).filter(isObj)
  const content = [...arr(item['media:content']), ...groups.flatMap(g => arr(g['media:content']))]
  const thumbs  = [...arr(item['media:thumbnail']), ...groups.flatMap(g => arr(g['media:thumbnail']))]
  const encl = [
    ...arr(item['enclosure']),
    ...arr(item['link']).filter(l => attr(l, 'rel') === 'enclosure'),
  ].map(e => (isObj(e) && !e['@_url'] && e['@_href'] ? { ...e, '@_url': e['@_href'] } : e))
   .filter(e => attr(e, 'type').toLowerCase().startsWith('image/') || (!attr(e, 'type') && IMG_EXT.test(attr(e, 'url'))))

  const hit = mediaImage(content) ?? mediaImage(thumbs) ?? mediaImage(encl)
  if (hit) return hit
  for (const html of htmlSources) {
    const found = firstImgSrc(toRawHtml(html))
    if (found) return found
  }
  return null
}

function itemLink(item: Node, atom: boolean): string | null {
  if (atom) {
    const links = arr(item['link']).filter(isObj)
    const alt = links.find(l => attr(l, 'rel') === 'alternate') ?? links.find(l => !attr(l, 'rel'))
    return alt ? sanitizeLink(attr(alt, 'href')) : null
  }
  for (const l of arr(item['link'])) {
    const text = rawText(l)
    if (text) return sanitizeLink(text)
    const href = attr(l, 'href')
    if (href && (!attr(l, 'rel') || attr(l, 'rel') === 'alternate')) return sanitizeLink(href)
  }
  return null
}

/**
 * Pure: XML string → normalized, de-duplicated, date-sorted items.
 * Never throws; problems are reported via `warnings`.
 */
export function normalizeFeed(xml: string, opts: { limit?: number } = {}): NormalizeResult {
  const warnings: string[] = []
  let doc: Node
  try {
    doc = parser.parse(xml) as Node
  } catch {
    return { format: 'unknown', items: [], warnings: ['xml_parse_failed'] }
  }

  let format: NormalizeResult['format'] = 'unknown'
  let rawItems: unknown[] = []
  const rss = doc['rss']
  const rdf = doc['rdf:RDF']
  const atomFeed = doc['feed']
  if (isObj(rss) && isObj(rss['channel'])) {
    format = 'rss'
    rawItems = arr((rss['channel'] as Node)['item'])
  } else if (isObj(rdf)) {
    format = 'rss'
    rawItems = arr(rdf['item'])
  } else if (isObj(atomFeed)) {
    format = 'atom'
    rawItems = arr(atomFeed['entry'])
  } else {
    warnings.push('unrecognized_root')
  }

  type Draft = { item: FeedItem; parsed: ParsedDate | null; order: number }
  const drafts: Draft[] = []
  let dropped = 0
  let badDates = 0

  rawItems.filter(isObj).forEach((n, order) => {
    const atom = format === 'atom'
    const link = itemLink(n, atom)
    const title = cleanText(rawText(n['title']))
    if (!link || !title) { dropped++; return }

    const descRaw    = rawText(n['description']) || rawText(n['summary'])
    const contentRaw = rawText(n['content:encoded']) || rawText(n['content'])
    let summary = cleanText(descRaw) || cleanText(contentRaw)
    if (!summary || summary.toLowerCase() === title.toLowerCase()) summary = ''
    summary = truncateWords(summary, 220)

    const dateRaw = rawText(n['pubDate']) || rawText(n['dc:date']) || rawText(n['published']) || rawText(n['updated'])
    const parsed = parseFeedDate(dateRaw)
    if (dateRaw && !parsed) badDates++

    const guid = cleanText(rawText(n['guid']) || rawText(n['id']))
    const imageUrl = extractImage(n, [descRaw, contentRaw])

    drafts.push({
      order,
      parsed,
      item: {
        id:       (guid || link).slice(0, 300),
        title,
        link,
        summary,
        date:     parsed ? parsed.iso : null,
        dateOnly: parsed ? !parsed.hasTime : false,
        ...(imageUrl ? { image: { url: imageUrl, alt: '' } } : {}),
      },
    })
  })

  if (dropped) warnings.push(`dropped_items:${dropped}`)
  if (badDates) warnings.push(`unparseable_dates:${badDates}`)

  // Feed-level placeholder stamp: every dated item at exactly 00:00 or 12:00.
  const dated = drafts.filter(d => d.parsed)
  if (dated.length > 0 && dated.every(d => d.parsed!.nominalTime)) {
    for (const d of dated) d.item.dateOnly = true
  }

  // Sort newest first (nulls last, stable), then de-duplicate by id and link.
  drafts.sort((a, b) => {
    if (a.item.date && b.item.date) return a.item.date < b.item.date ? 1 : a.item.date > b.item.date ? -1 : a.order - b.order
    if (a.item.date) return -1
    if (b.item.date) return 1
    return a.order - b.order
  })
  const seenId = new Set<string>()
  const seenLink = new Set<string>()
  const items: FeedItem[] = []
  for (const { item } of drafts) {
    if (seenId.has(item.id) || seenLink.has(item.link)) continue
    seenId.add(item.id)
    seenLink.add(item.link)
    items.push(item)
  }

  const limit = Math.min(Math.max(opts.limit ?? MAX_ITEMS, 1), MAX_ITEMS)
  return { format, items: items.slice(0, limit), warnings }
}
