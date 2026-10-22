import { headers } from 'next/headers'
import { getRequestBaseUrl, getRequestLocale } from '@/lib/optimizely'
import { fetchPageContent } from '@/lib/pageContent'

/** Content types that render without the site header, search and footer. */
const STANDALONE_TYPES = new Set(['OT_CampaignLandingPage'])

// Routes that never resolve through the CMS catch-all; skip the lookup entirely.
const NON_CMS_PREFIXES = ['/showcase', '/dev-booking-preview', '/campaign-preview']

// Non-CMS routes that render their own standalone frame (the campaign look demo).
const STANDALONE_ROUTES = ['/campaign-preview']

export type ShellMode = 'full' | 'standalone'

/**
 * Decides whether the current request gets the full site shell or a bare one.
 *
 * A layout renders before the page, so it cannot know the page type. The proxy
 * exposes the internal path; this looks the page up (sharing the page's own
 * cached fetch, so no extra Graph query) and opts the shell out for standalone
 * types. Any failure falls back to the full shell: the worst case is a campaign
 * page that shows navigation, never a broken page.
 */
export async function getShellMode(): Promise<ShellMode> {
  try {
    const h = await headers()
    const raw = h.get('x-internal-path')
    if (!raw || raw === '/') return 'full'
    const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw
    if (STANDALONE_ROUTES.includes(path)) return 'standalone'
    if (NON_CMS_PREFIXES.some(p => path === p || path.startsWith(`${p}/`))) return 'full'

    const [locale, baseUrl] = await Promise.all([getRequestLocale(), getRequestBaseUrl()])
    const exp = await fetchPageContent(path, locale, baseUrl)
    return exp?.__typename && STANDALONE_TYPES.has(exp.__typename) ? 'standalone' : 'full'
  } catch {
    return 'full'
  }
}
