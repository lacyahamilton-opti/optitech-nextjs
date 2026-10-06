import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  reviewCommentsEnabled, reviewHistoryEnabled, validateReviewInput,
  isReviewRateLimited, resetReviewRateLimit, sendReviewWebhook,
  saveReviewComment, getReviewComments, clientIp,
  type ReviewWebhookPayload, type StoredReviewComment,
} from '../lib/review-comments'
import { handleReviewComment } from '../lib/review-comment-handler'

const ENV_KEYS = ['MARK_REVIEW_WEBHOOK_URL', 'MARK_REVIEW_WEBHOOK_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'NODE_ENV', 'NEXT_PUBLIC_SITE_URL']
const env = process.env as Record<string, string | undefined>
let savedEnv: Record<string, string | undefined>
const realFetch = globalThis.fetch

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, env[k]]))
  for (const k of ENV_KEYS) delete env[k]
  resetReviewRateLimit()
})
afterEach(() => {
  for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete env[k]; else env[k] = savedEnv[k] }
  globalThis.fetch = realFetch
})

const KEY = 'a'.repeat(32)
const good = { name: 'Ada', comment: 'Looks good', key: KEY, ver: '3', loc: 'en', path: '/insights/post' }

type Call = { url: string; init: RequestInit }
function stubFetch(handler: (c: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  globalThis.fetch = (async (url: unknown, init: RequestInit = {}) => {
    const c = { url: String(url), init }
    calls.push(c)
    return handler(c)
  }) as typeof fetch
  return calls
}

// ── enabled gates ────────────────────────────────────────────────────────────
test('reviewCommentsEnabled', () => {
  assert.equal(reviewCommentsEnabled(), false)
  env.MARK_REVIEW_WEBHOOK_URL = 'not a url'
  assert.equal(reviewCommentsEnabled(), false)
  env.NODE_ENV = 'production'
  env.MARK_REVIEW_WEBHOOK_URL = 'http://localhost:9999/hook'
  assert.equal(reviewCommentsEnabled(), false)
  env.NODE_ENV = 'development'
  assert.equal(reviewCommentsEnabled(), true)
  env.MARK_REVIEW_WEBHOOK_URL = 'http://example.com/hook'
  assert.equal(reviewCommentsEnabled(), false)
  env.MARK_REVIEW_WEBHOOK_URL = 'https://mark.example.com/hook'
  assert.equal(reviewCommentsEnabled(), true)
})

test('reviewHistoryEnabled needs both KV vars', () => {
  env.KV_REST_API_URL = 'https://kv.example.com'
  assert.equal(reviewHistoryEnabled(), false)
  env.KV_REST_API_TOKEN = 't'
  assert.equal(reviewHistoryEnabled(), true)
})

// ── validation ───────────────────────────────────────────────────────────────
test('validateReviewInput accepts good input and normalises key', () => {
  const r = validateReviewInput({ ...good, key: KEY.toUpperCase().replace(/(.{8})/g, '$1-') })
  assert.ok(r.ok)
  if (r.ok) { assert.equal(r.value.key, KEY); assert.equal(r.honeypotTripped, false); assert.equal(r.value.email, undefined) }
})

test('validateReviewInput required fields and limits', () => {
  const bad = (o: object) => assert.equal(validateReviewInput({ ...good, ...o }).ok, false)
  bad({ name: '  ' }); bad({ name: 'x'.repeat(81) })
  bad({ comment: '' }); bad({ comment: 'x'.repeat(2001) })
  assert.ok(validateReviewInput({ ...good, comment: 'x'.repeat(2000), name: 'x'.repeat(80) }).ok)
  assert.equal(validateReviewInput(null).ok, false)
})

test('validateReviewInput strips control chars; newlines only in comment', () => {
  const r = validateReviewInput({ ...good, name: 'A\u0000d\na', comment: 'l1\u0007\nl2' })
  assert.ok(r.ok)
  if (r.ok) { assert.equal(r.value.name, 'Ad a'); assert.equal(r.value.comment, 'l1\nl2') }
})

test('validateReviewInput rejects bad key/ver/loc/path', () => {
  const bad = (o: object) => assert.equal(validateReviewInput({ ...good, ...o }).ok, false)
  bad({ key: 'xyz' }); bad({ ver: 'a b' }); bad({ ver: 'x'.repeat(65) }); bad({ loc: 'e' }); bad({ loc: 'en_US' })
  bad({ path: 'nope' }); bad({ path: '//evil.com' }); bad({ path: '/a://b' }); bad({ path: '/' + 'a'.repeat(512) })
  assert.ok(validateReviewInput({ ...good, ver: '', loc: '' }).ok)
  assert.ok(validateReviewInput({ ...good, loc: 'pt-BR' }).ok)
})

test('validateReviewInput email handling and honeypot', () => {
  assert.equal(validateReviewInput({ ...good, email: 'nope' }).ok, false)
  const ok = validateReviewInput({ ...good, email: 'a@b.co' })
  assert.ok(ok.ok && ok.value.email === 'a@b.co')
  const empty = validateReviewInput({ ...good, email: '   ' })
  assert.ok(empty.ok && empty.value.email === undefined)
  const hp = validateReviewInput({ ...good, website: 'http://spam' })
  assert.ok(hp.ok && hp.honeypotTripped)
})

// ── rate limit / ip ──────────────────────────────────────────────────────────
test('rate limiter: 5 allowed, 6th blocked, window resets', () => {
  for (let i = 0; i < 5; i++) assert.equal(isReviewRateLimited('1.1.1.1', 1000), false)
  assert.equal(isReviewRateLimited('1.1.1.1', 1000), true)
  assert.equal(isReviewRateLimited('2.2.2.2', 1000), false)
  assert.equal(isReviewRateLimited('1.1.1.1', 1000 + 60_001), false)
})

test('clientIp', () => {
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8' })), '9.9.9.9')
  assert.equal(clientIp(new Headers({ 'x-real-ip': '7.7.7.7' })), '7.7.7.7')
  assert.equal(clientIp(new Headers()), 'unknown')
})

// ── webhook ──────────────────────────────────────────────────────────────────
const payload: ReviewWebhookPayload = {
  event: 'external_review_comment', reviewer: { name: 'Ada' }, comment: 'hi',
  content: { key: KEY, version: '3', locale: 'en', url: 'https://site.test/p' }, submittedAt: '2026-01-01T00:00:00.000Z',
}

test('sendReviewWebhook payload, secret header only when set, false on non-2xx / throw', async () => {
  env.MARK_REVIEW_WEBHOOK_URL = 'https://mark.example.com/hook'
  const calls = stubFetch(() => new Response('ok', { status: 202 }))
  assert.equal(await sendReviewWebhook(payload), true)
  const h = calls[0].init.headers as Record<string, string>
  assert.equal(h['X-Review-Secret'], undefined)
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), payload)

  env.MARK_REVIEW_WEBHOOK_SECRET = 's3'
  assert.equal(await sendReviewWebhook(payload), true)
  assert.equal((calls[1].init.headers as Record<string, string>)['X-Review-Secret'], 's3')

  stubFetch(() => new Response('no', { status: 500 }))
  assert.equal(await sendReviewWebhook(payload), false)
  stubFetch(() => { throw new Error('boom') })
  assert.equal(await sendReviewWebhook(payload), false)
})

// ── KV ───────────────────────────────────────────────────────────────────────
const stored: StoredReviewComment = { id: '1', name: 'Ada', comment: 'c', ver: '3', loc: 'en', path: '/p', submittedAt: '2026-01-01T00:00:00.000Z' }

test('KV: no-op / [] when unset', async () => {
  const calls = stubFetch(() => new Response('{}'))
  await saveReviewComment(KEY, stored)
  assert.deepEqual(await getReviewComments(KEY), [])
  assert.equal(calls.length, 0)
})

test('KV: pipeline shape, newest-first read, bad entries skipped, [] on failure', async () => {
  env.KV_REST_API_URL = 'https://kv.example.com'; env.KV_REST_API_TOKEN = 'tok'
  let calls = stubFetch(() => Response.json([{ result: 1 }]))
  await saveReviewComment(KEY, stored)
  assert.equal(calls[0].url, 'https://kv.example.com/pipeline')
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer tok')
  const cmds = JSON.parse(String(calls[0].init.body))
  assert.deepEqual(cmds[0].slice(0, 2), ['RPUSH', `review:comments:${KEY}`])
  assert.deepEqual(cmds[1], ['LTRIM', `review:comments:${KEY}`, '-200', '-1'])
  assert.deepEqual(cmds[2], ['EXPIRE', `review:comments:${KEY}`, '5184000'])

  const older = { ...stored, id: 'old' }, newer = { ...stored, id: 'new' }
  calls = stubFetch(() => Response.json({ result: [JSON.stringify(older), '{bad', JSON.stringify(newer)] }))
  const got = await getReviewComments(KEY)
  assert.deepEqual(got.map(c => c.id), ['new', 'old'])
  assert.equal(calls[0].url, 'https://kv.example.com')

  stubFetch(() => new Response('x', { status: 500 }))
  assert.deepEqual(await getReviewComments(KEY), [])
})

// ── route handler ────────────────────────────────────────────────────────────
function req(body: unknown, init: { origin?: string; ip?: string; raw?: string; ct?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': init.ct ?? 'application/json', 'x-forwarded-for': init.ip ?? '3.3.3.3' }
  if (init.origin) headers.origin = init.origin
  return new Request('https://site.test/api/review-comment', { method: 'POST', headers, body: init.raw ?? JSON.stringify(body) })
}
const enable = () => { env.MARK_REVIEW_WEBHOOK_URL = 'https://mark.example.com/hook'; env.KV_REST_API_URL = 'https://kv.example.com'; env.KV_REST_API_TOKEN = 't' }
const draft = { isDraftMode: true }

test('handler: 404 when disabled, 403 without draft mode / cross-origin', async () => {
  assert.equal((await handleReviewComment(req(good), draft)).status, 404)
  enable()
  assert.equal((await handleReviewComment(req(good), { isDraftMode: false })).status, 403)
  assert.equal((await handleReviewComment(req(good, { origin: 'https://evil.test' }), draft)).status, 403)
})

test('handler: 400 bad body, 413 oversized, 429 after limit', async () => {
  enable()
  assert.equal((await handleReviewComment(req(null, { raw: '{nope' }), draft)).status, 400)
  assert.equal((await handleReviewComment(req(null, { ct: 'text/plain', raw: '{}' }), draft)).status, 400)
  assert.equal((await handleReviewComment(req({ ...good, comment: 'x'.repeat(20_000) }), draft)).status, 413)
  assert.equal((await handleReviewComment(req({ ...good, name: '' }), draft)).status, 400)
  resetReviewRateLimit()
  stubFetch(() => new Response('ok'))
  for (let i = 0; i < 5; i++) assert.equal((await handleReviewComment(req(good, { ip: '4.4.4.4' }), draft)).status, 200)
  const r = await handleReviewComment(req(good, { ip: '4.4.4.4' }), draft)
  assert.equal(r.status, 429)
  assert.equal(r.headers.get('retry-after'), '60')
})

test('handler: 502 on webhook failure with no KV write; 200 on success with KV write', async () => {
  enable()
  let calls = stubFetch(c => c.url.startsWith('https://mark') ? new Response('x', { status: 500 }) : Response.json([]))
  assert.equal((await handleReviewComment(req(good), draft)).status, 502)
  assert.equal(calls.some(c => c.url.startsWith('https://kv')), false)

  calls = stubFetch(() => Response.json([]))
  const res = await handleReviewComment(req({ ...good, email: 'a@b.co' }), draft)
  assert.equal(res.status, 200)
  assert.equal(calls[0].url, 'https://mark.example.com/hook')
  const sent = JSON.parse(String(calls[0].init.body))
  assert.equal(sent.content.url, 'https://site.test/insights/post')
  assert.equal(sent.reviewer.email, 'a@b.co')
  assert.equal(JSON.stringify(sent).includes('preview_token'), false)
  assert.ok(calls.some(c => c.url === 'https://kv.example.com/pipeline'))
})

test('handler: KV failure does not fail the request; honeypot is a silent 200', async () => {
  enable()
  stubFetch(c => c.url.startsWith('https://mark') ? new Response('ok') : new Response('x', { status: 500 }))
  assert.equal((await handleReviewComment(req(good), draft)).status, 200)
  const calls = stubFetch(() => new Response('ok'))
  const r = await handleReviewComment(req({ ...good, website: 'spam' }), draft)
  assert.equal(r.status, 200)
  assert.equal(calls.length, 0)
})
