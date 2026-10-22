import { cache } from 'react'

type CmsUrl = string | { default?: string | null; base?: string | null } | null | undefined

const host = (u: string) => {
  try { return new URL(u).host } catch { return '' }
}

// Request-scoped store for the host of the site being rendered. Populated by
// getRequestDomain() (which every layout/page calls first), so link resolution
// doesn't depend on NEXT_PUBLIC_SITE_URL being set correctly per deployment.
const requestHost = cache(() => ({ value: '' }))
export function setRequestHost(h: string) { if (h) requestHost().value = h }

/**
 * Resolves a Graph `url`/`link` property to an href. Links to content on
 * another site in the same CMS come back as a relative `default` plus a
 * foreign `base`; returning the relative path would send the visitor to this
 * site instead, so those are returned as absolute URLs.
 *
 * `ownHost` is this site's host. When omitted, the host recorded for the
 * current request is used, then the host of NEXT_PUBLIC_SITE_URL; if none is
 * known the relative path is kept.
 */
export function resolveCmsUrl(url: CmsUrl, ownHost?: string): string | undefined {
  if (!url) return undefined
  if (typeof url === 'string') return url
  const path = url.default
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path
  const base = url.base
  const own  = ownHost || requestHost().value || host(process.env.NEXT_PUBLIC_SITE_URL ?? '')
  if (!base || !own || host(base) === own) return path
  return `${base.replace(/\/$/, '')}${path}`
}
