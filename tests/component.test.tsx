import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import IndustryNewsFeed from '../components/blocks/IndustryNewsFeed'
import { layoutOptions } from '../lib/feeds/layouts'
import { normalizeFeed } from '../lib/feeds/normalize'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FeedResult, FeedItem } from '../lib/feeds/types'

const source = { id: 'healthcare', label: 'Healthcare', name: 'Healthcare Dive', homepage: 'https://www.healthcaredive.com/' }
const items: FeedItem[] = [
  { id: '1', title: 'With image', link: 'https://www.healthcaredive.com/a', summary: 'Summary one.', date: '2026-10-01T16:08:42.000Z', dateOnly: false, image: { url: 'https://imgproxy.divecdn.com/x.webp', alt: '' } },
  { id: '2', title: 'No image', link: 'https://www.healthcaredive.com/b', summary: '', date: '2026-09-30T00:00:00.000Z', dateOnly: true },
]
const ok: FeedResult = { status: 'ok', payload: { source, items } }
const html = (p: Partial<React.ComponentProps<typeof IndustryNewsFeed>> = {}) =>
  renderToStaticMarkup(<IndustryNewsFeed heading="News" result={ok} {...p} />)

test('renders every layout in layoutOptions', () => {
  for (const o of layoutOptions) {
    const h = html({ layout: o.value })
    assert.ok(h.includes(`data-layout="${o.value}"`), o.value)
    assert.ok(h.includes('With image') && h.includes('No image'), o.value)
    assert.ok(h.includes('data-has-image="true"') && h.includes('data-has-image="false"'), o.value)
  }
})

test('semantic structure: section, heading, ul/li/article, time, source', () => {
  const h = html()
  assert.match(h, /<section[^>]*aria-labelledby/)
  assert.match(h, /<h2[^>]*>News<\/h2>/)
  assert.match(h, /<ul[^>]*><li><article/)
  assert.match(h, /<h3[^>]*><a /)
  assert.match(h, /<time[^>]*dateTime="2026-10-01T16:08:42.000Z"|<time[^>]*datetime="2026-10-01T16:08:42.000Z"/i)
  assert.ok(h.includes('Source:'))
})

test('toggles hide sections', () => {
  assert.ok(!html({ showImage: false }).includes('<img'))
  assert.ok(!html({ showDate: false }).includes('<time'))
  assert.ok(!html({ showSummary: false }).includes('Summary one.'))
  assert.ok(!html({ showSource: false }).includes('Source:'))
  assert.ok(html().includes('<img'))
})

test('source attribution is a single pill link in the footer, gated by the toggle', () => {
  const h = html()
  assert.equal((h.match(/data-feed-pill/g) ?? []).length, 1)
  assert.match(h, /data-feed-source[^>]*>Source:[\s\S]*<a [^>]*href="https:\/\/www\.healthcaredive\.com\/"[^>]*><span data-feed-pill[^>]*>Healthcare Dive<\/span>/)
  assert.ok(!html({ showSource: false }).includes('data-feed-pill'))
})

test('image attributes', () => {
  const h = html()
  assert.match(h, /<img[^>]*alt=""/)
  assert.match(h, /<img[^>]*loading="lazy"/)
  assert.match(h, /<img[^>]*decoding="async"/)
  assert.match(h, /<img[^>]*referrerPolicy="no-referrer"|<img[^>]*referrerpolicy="no-referrer"/i)
})

test('timed dates render with time and zone', () => {
  const h = renderToStaticMarkup(<IndustryNewsFeed result={{ status: 'ok', payload: { source, items: [items[0]] } }} locale="en-US" />)
  assert.match(h, /Oct 1, 2026.*4:08 PM UTC/)
})

test('dateOnly omits time', () => {
  const h = renderToStaticMarkup(<IndustryNewsFeed result={{ status: 'ok', payload: { source, items: [items[1]] } }} locale="en-US" />)
  assert.ok(h.includes('Sep 30, 2026'))
  assert.ok(!/\d:\d\d/.test(/<time[^>]*>([^<]*)<\/time>/.exec(h)![1]))
})

test('empty state', () => {
  const h = html({ result: { status: 'ok', payload: { source, items: [] } } })
  assert.ok(h.includes('No recent stories'))
  assert.ok(!h.includes('<ul'))
})

test('unavailable state is generic with homepage escape hatch', () => {
  const h = html({ result: { status: 'unavailable', source } })
  assert.ok(h.includes('News is temporarily unavailable.'))
  assert.ok(h.includes('href="https://www.healthcaredive.com/"'))
  assert.match(h, /role="status"/)
  assert.ok(!/error|ECONN|stack/i.test(h))
})

test('external links: target + rel + sr-only hint', () => {
  const h = html()
  const anchors = [...h.matchAll(/<a [^>]*>/g)].map(m => m[0])
  assert.ok(anchors.length >= 3) // 2 headlines + source
  for (const a of anchors) {
    assert.ok(a.includes('target="_blank"'), a)
    assert.ok(a.includes('rel="noopener noreferrer"'), a)
  }
  assert.ok(h.includes('(opens in a new tab)'))
})

test('malicious fixture end-to-end: no raw HTML, no javascript: links', () => {
  const norm = normalizeFeed(readFileSync(join(__dirname, 'fixtures', 'malicious.xml'), 'utf8'))
  // Also inject hostile strings directly, bypassing the normalizer, to prove React escapes them.
  const hostile: FeedItem = { id: 'h', title: '<script>alert(1)</script>', link: 'https://example.com/h', summary: '<img src=x onerror=alert(1)>', date: null, dateOnly: false }
  const h = renderToStaticMarkup(<IndustryNewsFeed result={{ status: 'ok', payload: { source, items: [...norm.items, hostile] } }} />)
  assert.ok(!h.includes('<script'))
  assert.ok(!/<img[^>]*onerror/i.test(h))
  assert.ok(h.includes('&lt;script&gt;'))
  assert.ok(!/href="javascript:/i.test(h))
  assert.ok(!/href="data:/i.test(h))
})
