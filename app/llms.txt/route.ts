/**
 * Dynamic llms.txt route — served at /llms.txt
 *
 * The llms.txt specification (llmstxt.org) defines a plain-text file at the
 * site root that gives AI language models a structured, concise summary of
 * the site's purpose, content areas, and key pages — the same function that
 * robots.txt serves for traditional crawlers.
 *
 * Generated per request host from that site's ThemeManager: the Organization
 * Summary (or default meta description) is the one-line summary, and the
 * primary navigation (with its sub-items) becomes the "Key Pages" sections, so
 * every demo site on the shared instance describes itself — nothing is
 * hardcoded to one vertical. Storefront sites also list their catalog
 * categories.
 */

import { NextResponse }                           from 'next/server'
import { getSiteSettings, getRequestDomain, getRequestBaseUrl } from '@/lib/optimizely'
import { getCommerceSettings } from '@/lib/commerce/settings'
import { getCategories } from '@/lib/catalog'

export const dynamic = 'force-dynamic'

type NavLink = { menuLink?: { text?: string | null; url?: { default?: string | null } | null } | null }
type NavItem = NavLink & { subNavItems?: (NavLink & { description?: string | null })[] | null }

/** Absolute URL on this site for a nav link, or null for unresolvable/external links. */
function siteHref(raw: string | null | undefined, siteUrl: string, domain: string): string | null {
  if (!raw || raw.startsWith('cms://')) return null
  try {
    const u = new URL(raw, siteUrl)
    if (u.host !== domain && raw.startsWith('http')) return null
    return `${siteUrl}${u.pathname}`
  } catch {
    return null
  }
}

export async function GET() {
  const domain   = await getRequestDomain()
  const baseUrl  = await getRequestBaseUrl()
  const settings = await getSiteSettings(domain)

  const siteUrl      = baseUrl || `https://${domain}`
  const siteName     = (settings?.siteName as string | null)               ?? 'Site Accelerator'
  const orgDesc      = (settings?.organizationDescription as string | null) ?? ''
  const seoDesc      = (settings?.defaultSeoDescription as string | null)   ?? ''
  const description  = orgDesc || seoDesc

  const lines: string[] = [
    `# ${siteName}`,
    '',
    description ? `> ${description}` : `> ${siteName} — official website.`,
    '',
    '## Key Pages',
    '',
    `- [Homepage](${siteUrl}/)`,
  ]

  // One line per top-level nav item, then its sub-items as a nested section.
  const nav = (settings?.primaryNavigation ?? []) as NavItem[]
  const sections: string[] = []
  for (const item of nav) {
    const label = item.menuLink?.text?.trim()
    const href = siteHref(item.menuLink?.url?.default, siteUrl, domain)
    if (label && href) lines.push(`- [${label}](${href})`)
    const subs = (item.subNavItems ?? [])
      .map((s) => ({ label: s.menuLink?.text?.trim(), href: siteHref(s.menuLink?.url?.default, siteUrl, domain), desc: s.description?.trim() }))
      .filter((s): s is { label: string; href: string; desc: string | undefined } => !!s.label && !!s.href)
    if (label && subs.length) {
      sections.push('', `## ${label}`, '', ...subs.map((s) => `- [${s.label}](${s.href})${s.desc ? `: ${s.desc}` : ''}`))
    }
  }
  lines.push(...sections)

  // Storefront: catalog categories (CMS category pages + filtered listings).
  const commerce = await getCommerceSettings(domain)
  if (commerce) {
    const categories = (await getCategories(commerce.catalogId)).filter((c) => c.parentHandle)
    if (categories.length) {
      lines.push('', '## Shop by category', '')
      for (const c of categories) lines.push(`- [${c.name}](${siteUrl}${c.url})`)
    }
  }

  lines.push('', '## Contact', '', `Website: ${siteUrl}`)

  return new NextResponse(lines.join('\n').trimEnd(), {
    headers: {
      'Content-Type':  'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
