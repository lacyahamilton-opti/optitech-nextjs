import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeFetchFeed, FeedFetchError } from '../lib/feeds/safeFetch'
import type { FeedEntry } from '../lib/feeds/registry'

const entry: FeedEntry = {
  id: 't', label: 'T', sourceName: 'T', url: 'https://www.example-dive.com/feeds/news/',
  format: 'rss', homepage: 'https://www.example-dive.com/', expectsImages: true, enabled: true,
}
const xml = (body = '<rss/>', type = 'application/rss+xml; charset=utf-8', status = 200, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': type, ...extra } })
const redirect = (to: string, status = 301) => new Response(null, { status, headers: { location: to } })
const code = async (p: Promise<unknown>) => {
  try { await p } catch (e) { return e instanceof FeedFetchError ? e.code : `other:${e}` }
  return 'none'
}

test('happy path with Dive-style same-domain redirect (trailing slash)', async () => {
  const urls: string[] = []
  const f = (async (u: string) => {
    urls.push(u)
    return urls.length === 1 ? redirect('/feeds/news') : xml('<rss>ok</rss>')
  }) as unknown as typeof fetch
  const r = await safeFetchFeed(entry, { fetchImpl: f })
  assert.equal(r.body, '<rss>ok</rss>')
  assert.equal(urls[1], 'https://www.example-dive.com/feeds/news')
})

test('rejects non-https registry URL', async () => {
  const bad = { ...entry, url: 'http://www.example-dive.com/feed' }
  assert.equal(await code(safeFetchFeed(bad, { fetchImpl: (async () => xml()) as unknown as typeof fetch })), 'bad_url')
  const port = { ...entry, url: 'https://www.example-dive.com:8443/feed' }
  assert.equal(await code(safeFetchFeed(port, { fetchImpl: (async () => xml()) as unknown as typeof fetch })), 'bad_url')
})

test('rejects off-domain, http, and port redirects', async () => {
  for (const to of ['https://evil.com/feed', 'http://www.example-dive.com/feed', 'https://www.example-dive.com:444/x', 'https://example-dive.com.evil.com/x']) {
    const f = (async () => redirect(to)) as unknown as typeof fetch
    assert.equal(await code(safeFetchFeed(entry, { fetchImpl: f })), 'bad_redirect', to)
  }
})

test('allows same-registrable-domain subdomain redirect', async () => {
  let n = 0
  const f = (async () => (n++ === 0 ? redirect('https://cdn.example-dive.com/f') : xml())) as unknown as typeof fetch
  assert.equal(await code(safeFetchFeed(entry, { fetchImpl: f })), 'none')
})

test('max 3 redirect hops', async () => {
  let n = 0
  const f = (async () => redirect(`/hop${++n}`)) as unknown as typeof fetch
  assert.equal(await code(safeFetchFeed(entry, { fetchImpl: f })), 'too_many_redirects')
  assert.equal(n, 4) // initial + 3 followed hops, 4th redirect refused
})

test('rejects wrong content type and bad status', async () => {
  assert.equal(await code(safeFetchFeed(entry, { fetchImpl: (async () => xml('<html/>', 'text/html')) as unknown as typeof fetch })), 'bad_content_type')
  assert.equal(await code(safeFetchFeed(entry, { fetchImpl: (async () => xml('x', 'application/xml', 503)) as unknown as typeof fetch })), 'bad_status')
})

test('accepts allowed xml content types', async () => {
  for (const t of ['application/rss+xml', 'application/atom+xml', 'application/xml', 'text/xml; charset=UTF-8'])
    assert.equal(await code(safeFetchFeed(entry, { fetchImpl: (async () => xml('<a/>', t)) as unknown as typeof fetch })), 'none', t)
})

test('enforces size cap by streaming, ignoring Content-Length', async () => {
  const big = 'x'.repeat(5000)
  const f = (async () => xml(big, 'application/xml', 200, { 'content-length': '10' })) as unknown as typeof fetch
  assert.equal(await code(safeFetchFeed(entry, { fetchImpl: f, maxBytes: 1000 })), 'too_large')
  assert.equal(await code(safeFetchFeed(entry, { fetchImpl: f, maxBytes: 10_000 })), 'none')
})

test('enforces timeout', async () => {
  const keepAlive = setTimeout(() => {}, 2000) // AbortSignal.timeout's timer is unref'd; real fetch holds the loop open
  const f = ((_u: string, init: RequestInit) => new Promise((_res, rej) => {
    init.signal!.addEventListener('abort', () => rej(init.signal!.reason))
  })) as unknown as typeof fetch
  assert.equal(await code(safeFetchFeed(entry, { fetchImpl: f, timeoutMs: 50 })), 'timeout')
  clearTimeout(keepAlive)
})

test('network failure → generic code, never upstream text', async () => {
  const f = (async () => { throw new Error('ECONNREFUSED 10.0.0.1:443 secret-detail') }) as unknown as typeof fetch
  const e = await safeFetchFeed(entry, { fetchImpl: f }).catch(x => x)
  assert.ok(e instanceof FeedFetchError)
  assert.equal(e.message, 'network')
})

test('sends UA and Accept headers', async () => {
  let seen: Headers | undefined
  const f = (async (_u: string, init: RequestInit) => { seen = new Headers(init.headers); return xml() }) as unknown as typeof fetch
  await safeFetchFeed(entry, { fetchImpl: f, userAgent: 'Test-FeedReader/1.0' })
  assert.equal(seen!.get('user-agent'), 'Test-FeedReader/1.0')
  assert.match(seen!.get('accept')!, /application\/rss\+xml/)
})
