import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeFeed } from '../lib/feeds/normalize'

const fx = (n: string) => readFileSync(join(__dirname, 'fixtures', n), 'utf8')

test('Dive-style RSS: image from escaped description HTML, entities decoded, newest first', () => {
  const r = normalizeFeed(fx('dive.xml'))
  assert.equal(r.format, 'rss')
  assert.ok(r.items.length >= 2)
  const a = r.items[0]
  assert.match(a.image!.url, /^https:\/\/imgproxy\.divecdn\.com\//)
  assert.equal(a.image!.alt, '')
  assert.ok(!/[<>]/.test(a.summary))
  assert.ok(a.summary.includes('administration’s first attempt'), a.summary) // &rsquo;&nbsp; decoded
  assert.ok(a.summary.length <= 221)
  assert.equal(a.dateOnly, false)
  const dates = r.items.map(i => i.date!)
  assert.deepEqual([...dates].sort().reverse(), dates)
})

test('Insurance Journal: enclosure image, truncated description kept', () => {
  const r = normalizeFeed(fx('insurance-journal.xml'))
  assert.ok(r.items.length > 0)
  assert.ok(r.items.some(i => i.image && i.image.url.startsWith('https://')))
  for (const i of r.items) assert.ok(!/<|&#8230;/.test(i.summary))
})

test('SCOTUSblog: CDATA description + media:content', () => {
  const r = normalizeFeed(fx('scotusblog.xml'))
  assert.ok(r.items.length > 0)
  for (const i of r.items) {
    assert.ok(!/<!--|<\w/.test(i.summary), i.summary)
    assert.ok(i.summary.length <= 221)
  }
  assert.ok(r.items.some(i => i.image))
})

test('text-only fallback: no image, summary==title hidden, entities, undated last, deduped', () => {
  const r = normalizeFeed(fx('text-only.xml'))
  assert.equal(r.items.length, 3) // duplicate link dropped
  assert.ok(r.items.every(i => !i.image))
  const same = r.items.find(i => i.link === 'https://example.com/one')!
  assert.equal(same.summary, '')
  const two = r.items.find(i => i.link === 'https://example.com/two')!
  assert.equal(two.title, 'Leading newline title … with entity')
  assert.equal(r.items.at(-1)!.date, null)
  assert.ok(r.warnings.some(w => w.startsWith('unparseable_dates')))
  assert.equal(r.items[0].link, 'https://example.com/two') // newest
})

test('Atom: alternate link, utm stripped, thumbnail, rel-less link, content fallback', () => {
  const r = normalizeFeed(fx('atom.xml'))
  assert.equal(r.format, 'atom')
  assert.equal(r.items.length, 2)
  const a = r.items[0]
  assert.equal(a.link, 'https://www.insurancebusinessmag.com/us/news/a-1?id=7')
  assert.equal(a.title, 'Carriers tighten catastrophe & wildfire underwriting')
  assert.equal(a.summary, 'Underwriters are rethinking wildfire exposure.')
  assert.equal(a.image!.url, 'https://cdn.example-insurance.com/a-1.jpg')
  assert.equal(a.date, '2026-09-30T12:15:00.000Z')
  const b = r.items[1]
  assert.equal(b.link, 'https://www.insurancebusinessmag.com/us/news/a-2')
  assert.equal(b.summary, 'Plain content body.')
})

test('NIH-style: date format, no images, double-encoded nbsp', () => {
  const r = normalizeFeed(fx('nih.xml'))
  assert.ok(r.items.length > 0)
  assert.ok(r.items.every(i => i.date && !i.image))
  for (const i of r.items) assert.ok(!/&nbsp;|&amp;|<\w/.test(i.summary), i.summary)
})

test('malicious fixture: no HTML, javascript:/data:/credential links dropped, http images dropped', () => {
  const r = normalizeFeed(fx('malicious.xml'))
  const links = r.items.map(i => i.link)
  assert.deepEqual(links.sort(), ['https://example.com/img', 'https://example.com/ok'])
  for (const i of r.items) {
    assert.ok(!/<|>/.test(i.title + i.summary), `${i.title} | ${i.summary}`)
    assert.ok(!i.image)
  }
  const ok = r.items.find(i => i.link.endsWith('/ok'))!
  assert.ok(!/script|onerror|wp:paragraph/.test(ok.title + ok.summary))
})

test('garbage / non-feed input never throws', () => {
  assert.equal(normalizeFeed('not xml at all').items.length, 0)
  assert.equal(normalizeFeed('<html><body>hi</body></html>').items.length, 0)
  assert.equal(normalizeFeed('').items.length, 0)
})

test('limit slices after sort', () => {
  assert.equal(normalizeFeed(fx('text-only.xml'), { limit: 1 }).items.length, 1)
})
