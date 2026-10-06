/**
 * External Preview Link helpers — shared by /preview and the [...slug] route.
 *
 * The link routes through /api/draft, which enables Next.js draft mode and
 * forwards the preview params to the page's own URL. `ext_preview=1` tells the
 * slug route the visitor is an external reviewer (show DraftStateBanner) rather
 * than the CMS editor (show ExternalPreviewLinkPanel).
 */

type ExternalPreviewInput = {
  enabled:      unknown
  baseUrl:      string
  previewToken: string
  key:          string
  ver:          string
  loc:          string
  /** Front-end pathname of the page, e.g. "/insights/my-post". */
  path:         string | null | undefined
}

/** Returns the shareable draft URL, or null when the page hasn't opted in. */
export function buildExternalPreviewUrl(input: ExternalPreviewInput): string | null {
  const { enabled, baseUrl, previewToken, key, ver, loc, path } = input
  if (enabled !== true || !baseUrl || !previewToken || !path) return null
  const qs = new URLSearchParams({
    preview_token: previewToken,
    key,
    ver,
    loc,
    ctx:           path,
    ext_preview:   '1',
  })
  return `${baseUrl}/api/draft?${qs}`
}

/** Resolves an absolute or relative URL to just the pathname. */
export function toPathname(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    return raw.startsWith('http') ? new URL(raw).pathname : raw
  } catch {
    return raw.startsWith('/') ? raw : null
  }
}

/** The fields external-preview logic reads from any page/experience item. */
export type PreviewableContent = {
  enableExternalPreview?: boolean | null
  _metadata?: { url?: { default?: string | null; hierarchical?: string | null } | null } | null
}

/** Prefers the hierarchical (ancestor-resolved) URL, falling back to default. */
export function contentPathname(content: PreviewableContent | null | undefined): string | null {
  return toPathname(content?._metadata?.url?.hierarchical ?? content?._metadata?.url?.default)
}
