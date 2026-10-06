import type { FeedEntry } from './registry'

export const FETCH_TIMEOUT_MS = 5_000
export const MAX_BYTES        = 2 * 1024 * 1024
export const MAX_REDIRECTS    = 3
export const REVALIDATE_S     = 900

const ALLOWED_TYPES = ['application/rss+xml', 'application/atom+xml', 'application/xml', 'text/xml']

export type FetchFailure =
  | 'bad_url' | 'bad_redirect' | 'too_many_redirects' | 'bad_status'
  | 'bad_content_type' | 'too_large' | 'timeout' | 'network'

export class FeedFetchError extends Error {
  constructor(public readonly code: FetchFailure, public readonly status?: number) {
    super(code)
    this.name = 'FeedFetchError'
  }
}

export type SafeFetchOptions = {
  fetchImpl?:  typeof fetch
  timeoutMs?:  number
  maxBytes?:   number
  maxRedirects?: number
  userAgent?:  string
}

export type SafeFetchResult = {
  status:      number
  body:        string
  contentType: string
  finalUrl:    string
}

// Registrable domain without a PSL: last two labels, or last three for the
// common `co.uk`-style second-level suffixes. Sufficient for a fixed registry.
const SLD = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'])
export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.')
  if (labels.length <= 2) return labels.join('.')
  const tld = labels[labels.length - 1]
  const sld = labels[labels.length - 2]
  return (tld.length === 2 && SLD.has(sld) ? labels.slice(-3) : labels.slice(-2)).join('.')
}

/** https only, default port only, no credentials, same registrable domain as the registry entry. */
export function assertAllowedUrl(candidate: string, entry: FeedEntry, code: FetchFailure): URL {
  let u: URL
  try { u = new URL(candidate) } catch { throw new FeedFetchError(code) }
  if (u.protocol !== 'https:' || u.port !== '' || u.username || u.password) throw new FeedFetchError(code)
  const base = new URL(entry.url)
  if (registrableDomain(u.hostname) !== registrableDomain(base.hostname)) throw new FeedFetchError(code)
  return u
}

export function userAgent(): string {
  if (process.env.FEED_USER_AGENT) return process.env.FEED_USER_AGENT
  const contact = process.env.FEED_CONTACT_URL
  return `SiteAccelerator-FeedReader/1.0${contact ? ` (+${contact})` : ''}`
}

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new FeedFetchError('too_large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.byteLength }
  return out
}

function decode(bytes: Uint8Array, contentType: string): string {
  const cs = /charset=["']?([\w-]+)/i.exec(contentType)?.[1]
  try { return new TextDecoder(cs ?? 'utf-8').decode(bytes) } catch { return new TextDecoder('utf-8').decode(bytes) }
}

/**
 * The only function that fetches feed XML. URL always comes from the registry
 * entry; every redirect hop is re-validated. Throws FeedFetchError (code only —
 * never upstream text) on any failure.
 */
export async function safeFetchFeed(entry: FeedEntry, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const doFetch = opts.fetchImpl ?? fetch
  const maxRedirects = opts.maxRedirects ?? MAX_REDIRECTS
  const signal = AbortSignal.timeout(opts.timeoutMs ?? FETCH_TIMEOUT_MS) // total budget across hops

  let url = assertAllowedUrl(entry.url, entry, 'bad_url')
  for (let hop = 0; ; hop++) {
    let res: Response
    try {
      res = await doFetch(url.toString(), {
        redirect: 'manual',
        signal,
        headers: {
          'User-Agent': opts.userAgent ?? userAgent(),
          Accept: 'application/rss+xml, application/atom+xml, text/xml;q=0.9, */*;q=0.1',
        },
        next: { revalidate: REVALIDATE_S },
      } as RequestInit)
    } catch (err) {
      const name = (err as { name?: string })?.name
      throw new FeedFetchError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network')
    }

    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel().catch(() => {})
      const loc = res.headers.get('location')
      if (!loc) throw new FeedFetchError('bad_redirect', res.status)
      if (hop >= maxRedirects) throw new FeedFetchError('too_many_redirects', res.status)
      let next: string
      try { next = new URL(loc, url).toString() } catch { throw new FeedFetchError('bad_redirect', res.status) }
      url = assertAllowedUrl(next, entry, 'bad_redirect')
      continue
    }

    if (res.status < 200 || res.status >= 300) {
      await res.body?.cancel().catch(() => {})
      throw new FeedFetchError('bad_status', res.status)
    }

    const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
    const mime = contentType.split(';')[0].trim()
    if (!ALLOWED_TYPES.includes(mime)) {
      await res.body?.cancel().catch(() => {})
      throw new FeedFetchError('bad_content_type', res.status)
    }

    try {
      const bytes = await readCapped(res, opts.maxBytes ?? MAX_BYTES) // Content-Length is not trusted
      return { status: res.status, body: decode(bytes, contentType), contentType: mime, finalUrl: url.toString() }
    } catch (err) {
      if (err instanceof FeedFetchError) throw err
      const name = (err as { name?: string })?.name
      throw new FeedFetchError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network')
    }
  }
}
