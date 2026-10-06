import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeedDate } from '../lib/feeds/date'

const iso = (s: string) => parseFeedDate(s)?.iso

test('RFC 822 numeric offsets', () => {
  assert.equal(iso('Thu, 01 Oct 2026 12:08:42 -0400'), '2026-10-01T16:08:42.000Z')
  assert.equal(iso('Thu, 01 Oct 2026 12:08:42 +0000'), '2026-10-01T12:08:42.000Z')
  assert.equal(iso('Thu, 01 Oct 2026 12:08 +0530'), '2026-10-01T06:38:00.000Z')
})
test('RFC 822 zone names', () => {
  assert.equal(iso('Thu, 01 Oct 2026 12:00:00 EDT'), '2026-10-01T16:00:00.000Z')
  assert.equal(iso('Thu, 01 Jan 2026 12:00:00 EST'), '2026-01-01T17:00:00.000Z')
  assert.equal(iso('Thu, 01 Oct 2026 12:00:00 GMT'), '2026-10-01T12:00:00.000Z')
  assert.equal(iso('Thu, 01 Oct 2026 12:00:00 PDT'), '2026-10-01T19:00:00.000Z')
})
test('ISO 8601', () => {
  assert.equal(iso('2026-09-30T08:15:00-04:00'), '2026-09-30T12:15:00.000Z')
  assert.equal(iso('2026-09-30T08:15:00Z'), '2026-09-30T08:15:00.000Z')
  assert.equal(iso('2026-09-30T08:15:00.123+00:00'), '2026-09-30T08:15:00.000Z')
  const d = parseFeedDate('2026-09-30')!
  assert.equal(d.hasTime, false)
  assert.equal(d.iso, '2026-09-30T00:00:00.000Z')
})
test('NIH format', () => {
  const d = parseFeedDate('Mon, 09/14/2026 - 11:00')!
  assert.equal(d.iso, '2026-09-14T11:00:00.000Z')
  assert.equal(d.hasTime, true)
  assert.equal(d.nominalTime, false)
})
test('nominal placeholder times flagged', () => {
  assert.equal(parseFeedDate('Thu, 01 Oct 2026 00:00:00 +0000')!.nominalTime, true)
  assert.equal(parseFeedDate('Thu, 01 Oct 2026 12:00:00 +0000')!.nominalTime, true)
  assert.equal(parseFeedDate('Thu, 01 Oct 2026 12:01:00 +0000')!.nominalTime, false)
})
test('garbage → null', () => {
  for (const g of ['', 'garbage', 'Invalid Date', '31 Feb 2026 10:00:00 GMT', '2026-13-40T00:00:00Z', 'Thu, 01 Oct 2026 12:00:00 QQQQ', '99/99/2026', 'x'.repeat(200)])
    assert.equal(parseFeedDate(g), null, g)
  assert.equal(parseFeedDate(undefined), null)
  assert.equal(parseFeedDate(42), null)
})
