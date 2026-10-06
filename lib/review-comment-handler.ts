// Request handler for POST /api/review-comment. Lives in lib/ (not the route
// file) so tests can call it directly with injected draft-mode state — Next
// route files may only export HTTP methods and route config.

import {
  clientIp,
  isReviewRateLimited,
  reviewCommentsEnabled,
  saveReviewComment,
  sendReviewWebhook,
  validateReviewInput,
  type ReviewWebhookPayload,
} from '@/lib/review-comments'

const MAX_BODY_BYTES = 10 * 1024

const json = (body: unknown, status: number, headers?: Record<string, string>) =>
  Response.json(body, { status, headers })

export async function handleReviewComment(
  request: Request,
  deps: { isDraftMode: boolean },
): Promise<Response> {
  // 1. Feature off → look like the route does not exist.
  if (!reviewCommentsEnabled()) return new Response(null, { status: 404 })

  // 2. Draft mode proves the caller arrived through a preview link.
  if (!deps.isDraftMode) return new Response(null, { status: 403 })

  // 3. Same-origin only.
  const requestOrigin = new URL(request.url).origin
  const origin = request.headers.get('origin')
  if (origin && origin !== requestOrigin) return new Response(null, { status: 403 })

  // 4. JSON body, size-capped.
  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return json({ error: 'Invalid request.' }, 400)
  }
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return json({ error: 'Request too large.' }, 413)
  let text: string
  try {
    text = await request.text()
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return json({ error: 'Request too large.' }, 413)
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }

  // 5. Rate limit (per-instance backstop).
  if (isReviewRateLimited(clientIp(request.headers))) {
    return json({ error: 'Too many submissions. Please wait a minute and try again.' }, 429, {
      'Retry-After': '60',
    })
  }

  // 6. Validate. Honeypot gets a fake success and nothing else happens.
  const parsed = validateReviewInput(raw)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  if (parsed.honeypotTripped) return json({ ok: true }, 200)
  const v = parsed.value

  // 7. Forward to Mark. Do not store on failure — the reviewer will retry.
  const siteOrigin  = (process.env.NEXT_PUBLIC_SITE_URL || requestOrigin).replace(/\/$/, '')
  const submittedAt = new Date().toISOString()
  const payload: ReviewWebhookPayload = {
    event:    'external_review_comment',
    reviewer: { name: v.name, ...(v.email ? { email: v.email } : {}) },
    comment:  v.comment,
    content: {
      key:     v.key,
      version: v.ver,
      locale:  v.loc,
      ...(v.title ? { title: v.title } : {}),
      url:     `${siteOrigin}${v.path}`, // never includes preview_token
      // cmsEditUrl omitted: no CMS edit-URL shape is established in this repo.
    },
    submittedAt,
  }
  if (!(await sendReviewWebhook(payload))) {
    return json({ error: 'We could not send your feedback right now. Please try again.' }, 502)
  }

  // 8. Best-effort history; a KV failure must not fail the request.
  try {
    await saveReviewComment(v.key, {
      id:      crypto.randomUUID(),
      name:    v.name,
      ...(v.email ? { email: v.email } : {}),
      comment: v.comment,
      ver:     v.ver,
      loc:     v.loc,
      path:    v.path,
      submittedAt,
    })
  } catch {
    console.error('[review-comment] could not store comment')
  }
  return json({ ok: true }, 200)
}
