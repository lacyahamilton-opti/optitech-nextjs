import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeedRequest } from '../lib/feeds/request'
import { FEED_REGISTRY, enabledFeeds, getEnabledFeed } from '../lib/feeds/registry'
import { isRateLimited, _resetRateLimit } from '../lib/feeds/rateLimit'
import { GET } from '../app/api/feeds/[feedId]/route'

const q = (s = '') => new URLSearchParams(s)

test('unknown feedId → 404', () => {
  for (const id of ['nope', '', '../etc/passwd', 'HEALTHCARE', 'https://evil.com', '__proto__', 'constructor', undefined, 5])
    assert.deepEqual(parseFeedRequest(id, q()), { ok: false, status: 404 }, String(id))
})

test('disabled feed → 404', () => {
  const disabled = FEED_REGISTRY.find(f => !f.enabled)!
  assert.equal(getEnabledFeed(disabled.id), undefined)
  assert.deepEqual(parseFeedRequest(disabled.id, q()), { ok: false, status: 404 })
})

test('limit: default 6, clamp 1–12, reject non-integers with 400', () => {
  const ok = (s: string) => { const r = parseFeedRequest('healthcare', q(s)); assert.ok(r.ok); return r.limit }
  assert.equal(ok(''), 6)
  assert.equal(ok('limit=3'), 3)
  assert.equal(ok('limit=0'), 1)
  assert.equal(ok('limit=99'), 12)
  assert.equal(ok('limit=-5'), 1)
  for (const bad of ['limit=abc', 'limit=1.5', 'limit=', 'limit=1e3', 'limit=3&limit=4', 'limit=%20', 'limit=0x10'])
    assert.deepEqual(parseFeedRequest('healthcare', q(bad)), { ok: false, status: 400 }, bad)
})

test('other query params ignored (incl. url)', () => {
  const r = parseFeedRequest('banking', q('url=https://evil.com&limit=2&x=1'))
  assert.ok(r.ok)
  assert.equal(r.limit, 2)
  assert.equal(r.entry.url, 'https://www.bankingdive.com/feeds/news/')
})

test('every enabled registry entry is https on its own domain', () => {
  for (const f of enabledFeeds()) {
    assert.equal(new URL(f.url).protocol, 'https:')
    assert.equal(new URL(f.homepage).protocol, 'https:')
  }
})

test('route: generic responses for 404 / 400, no CORS headers', async () => {
  _resetRateLimit()
  const call = (id: string, qs = '') =>
    GET(new Request(`http://localhost/api/feeds/${id}${qs}`), { params: Promise.resolve({ feedId: id }) })
  const r404 = await call('nope')
  assert.equal(r404.status, 404)
  assert.deepEqual(await r404.json(), { error: 'unavailable' })
  const r400 = await call('healthcare', '?limit=zzz')
  assert.equal(r400.status, 400)
  assert.deepEqual(await r400.json(), { error: 'unavailable' })
  assert.equal(r400.headers.get('access-control-allow-origin'), null)
  assert.equal((await call(FEED_REGISTRY.find(f => !f.enabled)!.id)).status, 404)
})

test('rate limit: enforce vs log-only', () => {
  _resetRateLimit()
  process.env.FEED_RATE_LIMIT = '3'
  delete process.env.FEED_RATE_LIMIT_MODE
  const res = [1, 2, 3, 4, 5].map(() => isRateLimited('1.2.3.4', 1000))
  assert.deepEqual(res, [false, false, false, true, true])
  assert.equal(isRateLimited('9.9.9.9', 1000), false)
  assert.equal(isRateLimited('1.2.3.4', 1000 + 61_000), false) // new window
  _resetRateLimit()
  process.env.FEED_RATE_LIMIT_MODE = 'log'
  assert.deepEqual([1, 2, 3, 4, 5].map(() => isRateLimited('1.2.3.4', 1000)), [false, false, false, false, false])
  delete process.env.FEED_RATE_LIMIT; delete process.env.FEED_RATE_LIMIT_MODE
})
