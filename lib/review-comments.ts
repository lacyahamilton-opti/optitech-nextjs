// ─── External reviewer comments ──────────────────────────────────────────────
//
// Server-side helpers for the External Preview feedback widget. Reviewers who
// open a draft page via an External Preview Link can leave a comment; it is
// forwarded to a Mark webhook (which emails the content author) and, when KV is
// configured, stored so the author can see it in the CMS preview.
//
// Server-only: reads secrets from process.env. Never import from a client
// component, and never return the webhook URL/secret in any response or log.
//
// Env vars:
//   MARK_REVIEW_WEBHOOK_URL    — https URL (http://localhost allowed outside prod)
//   MARK_REVIEW_WEBHOOK_SECRET — sent as X-Review-Secret when set
//   KV_REST_API_URL / KV_REST_API_TOKEN — Upstash/Vercel KV (both required)

// ── Types ────────────────────────────────────────────────────────────────────

export type ReviewCommentInput = {
  name:    string
  email?:  string
  comment: string
  key:     string
  ver:     string
  loc:     string
  path:    string
  title?:  string
}

export type StoredReviewComment = {
  id:          string
  name:        string
  email?:      string
  comment:     string
  ver:         string
  loc:         string
  path:        string
  submittedAt: string
}

export type ReviewWebhookPayload = {
  event: 'external_review_comment'
  // Reviewer name/email are self-reported and unverified — Mark's email
  // template should say so.
  reviewer:    { name: string; email?: string }
  comment:     string
  content: {
    key:      string
    version:  string
    locale:   string
    title?:   string
    /** Absolute page URL. Never carries preview_token. */
    url:      string
    cmsEditUrl?: string
  }
  submittedAt: string
}

// ── Configuration gates ──────────────────────────────────────────────────────

function webhookUrl(): URL | null {
  const raw = process.env.MARK_REVIEW_WEBHOOK_URL
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol === 'https:') return u
    if (
      u.protocol === 'http:' &&
      u.hostname === 'localhost' &&
      process.env.NODE_ENV !== 'production'
    ) return u
    return null
  } catch {
    return null
  }
}

/** True when a valid Mark webhook URL is configured. Off = feature fully hidden. */
export function reviewCommentsEnabled(): boolean {
  return webhookUrl() !== null
}

function kvConfig(): { url: string; token: string } | null {
  const url   = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  return url && token ? { url, token } : null
}

/** True when durable KV storage is configured (no in-memory fallback by design). */
export function reviewHistoryEnabled(): boolean {
  return kvConfig() !== null
}

// ── Validation ───────────────────────────────────────────────────────────────

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VER_RE        = /^[A-Za-z0-9._-]{1,64}$/
const LOC_RE        = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/
const KEY_RE        = /^[0-9a-f]{32}$/

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Trim + strip control chars. Single-line fields also flatten newlines. */
function clean(v: unknown, multiline = false): string {
  let s = str(v).replace(CONTROL_CHARS, '')
  if (!multiline) s = s.replace(/[\r\n]+/g, ' ')
  return s.trim()
}

export function validateReviewInput(
  raw: unknown,
):
  | { ok: true; value: ReviewCommentInput; honeypotTripped: boolean }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid request.' }
  }
  const r = raw as Record<string, unknown>

  const name    = clean(r.name)
  const comment = clean(r.comment, true)
  const email   = clean(r.email)
  const key     = clean(r.key).replace(/-/g, '').toLowerCase()
  const ver     = clean(r.ver)
  const loc     = clean(r.loc)
  const path    = clean(r.path)
  const title   = clean(r.title)
  const honeypotTripped = clean(r.website).length > 0

  if (!name)                return { ok: false, error: 'Please enter your name.' }
  if (name.length > 80)     return { ok: false, error: 'Name must be 80 characters or fewer.' }
  if (!comment)             return { ok: false, error: 'Please enter a comment.' }
  if (comment.length > 2000) return { ok: false, error: 'Comment must be 2000 characters or fewer.' }
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
    return { ok: false, error: 'Please enter a valid email address, or leave it blank.' }
  }
  if (!KEY_RE.test(key))              return { ok: false, error: 'This page cannot accept feedback.' }
  if (ver && !VER_RE.test(ver))       return { ok: false, error: 'This page cannot accept feedback.' }
  if (loc && !LOC_RE.test(loc))       return { ok: false, error: 'This page cannot accept feedback.' }
  if (
    !path.startsWith('/') || path.length > 512 ||
    path.startsWith('//') || path.includes('://') || path.includes('\\')
  ) {
    return { ok: false, error: 'This page cannot accept feedback.' }
  }
  if (title.length > 200) return { ok: false, error: 'This page cannot accept feedback.' }

  return {
    ok: true,
    honeypotTripped,
    value: {
      name, comment, key, ver, loc, path,
      ...(email ? { email } : {}),
      ...(title ? { title } : {}),
    },
  }
}

// ── Rate limiting ────────────────────────────────────────────────────────────
// Hard-coded fixed window: 5 submissions / 60s per IP. In-memory, so this is a
// per-instance backstop only — serverless instances do not share it.

const RATE_LIMIT  = 5
const RATE_WINDOW = 60_000
const RATE_MAX_ENTRIES = 10_000
const hits = new Map<string, { count: number; resetAt: number }>()

export function isReviewRateLimited(ip: string, now: number = Date.now()): boolean {
  if (hits.size > RATE_MAX_ENTRIES) {
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
    if (hits.size > RATE_MAX_ENTRIES) hits.clear()
  }
  const entry = hits.get(ip)
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT
}

/** Test helper. */
export function resetReviewRateLimit(): void {
  hits.clear()
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim().slice(0, 64)
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim().slice(0, 64) || 'unknown'
}

// ── Mark webhook ─────────────────────────────────────────────────────────────

/** Resolves true only on a 2xx response. Never throws; never logs URL/secret/body. */
export async function sendReviewWebhook(payload: ReviewWebhookPayload): Promise<boolean> {
  const url = webhookUrl()
  if (!url) return false
  const secret = process.env.MARK_REVIEW_WEBHOOK_SECRET
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Review-Secret': secret } : {}),
      },
      body:   JSON.stringify(payload),
      cache:  'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error(`[review-comment] webhook responded ${res.status}`)
    return res.ok
  } catch (err) {
    console.error('[review-comment] webhook request failed:', err instanceof Error ? err.name : 'error')
    return false
  }
}

// ── KV storage (Upstash REST, plain fetch) ───────────────────────────────────

const MAX_COMMENTS = 200
const TTL_SECONDS  = 60 * 24 * 60 * 60 // 60 days, refreshed on every write
const redisKey = (contentKey: string) => `review:comments:${contentKey}`

async function kvRequest(path: string, body: unknown): Promise<unknown> {
  const cfg = kvConfig()
  if (!cfg) return null
  const res = await fetch(`${cfg.url.replace(/\/$/, '')}${path}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    cache:   'no-store',
    signal:  AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`KV request failed: ${res.status}`)
  return res.json()
}

export async function saveReviewComment(key: string, c: StoredReviewComment): Promise<void> {
  if (!reviewHistoryEnabled()) return
  const k = redisKey(key)
  await kvRequest('/pipeline', [
    ['RPUSH', k, JSON.stringify(c)],
    ['LTRIM', k, String(-MAX_COMMENTS), '-1'],
    ['EXPIRE', k, String(TTL_SECONDS)],
  ])
}

/** Newest first. Returns [] when KV is unset or on any failure. */
export async function getReviewComments(key: string): Promise<StoredReviewComment[]> {
  if (!reviewHistoryEnabled()) return []
  try {
    const json = (await kvRequest('', ['LRANGE', redisKey(key), '0', '-1'])) as
      { result?: unknown } | null
    const rows = Array.isArray(json?.result) ? json.result : []
    const out: StoredReviewComment[] = []
    for (const row of rows) {
      try {
        const c = JSON.parse(String(row)) as StoredReviewComment
        if (c && typeof c.comment === 'string' && typeof c.name === 'string') out.push(c)
      } catch {
        // skip malformed entry
      }
    }
    return out.reverse()
  } catch {
    return []
  }
}
