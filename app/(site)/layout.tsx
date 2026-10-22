import Header from "@/components/layout/Header"
import SplitHeader from "@/components/layout/SplitHeader"
import SidebarNav from "@/components/layout/SidebarNav"
import Footer from "@/components/layout/Footer"
import ScrollToTop from "@/components/ui/ScrollToTop"
import { SearchProvider } from "@/components/search/SearchProvider"
import SiteSearch from "@/components/search/SiteSearch"
import { LocaleProvider } from "@/lib/i18n/LocaleProvider"
import { getRequestLocale, getRequestDomain, getSiteSettings } from "@/lib/optimizely"
import { resolveNavbarStyle } from "@/lib/theme-axes"
import { getShellMode } from "@/lib/shellMode"
import ShellModeGuard from "@/components/layout/ShellModeGuard"
import { getTokenMap } from "@/lib/tokens"
import { TokenProvider } from "@/components/providers/TokenProvider"
import { getCommerceSettings, currencyForLocale, getMarketCookie } from "@/lib/commerce/settings"
import { marketFor } from "@/lib/commerce/market"
import CommerceProvider from "@/components/commerce/CommerceProvider"
import MiniBag from "@/components/commerce/MiniBag"

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const locale       = await getRequestLocale()
  const domain       = await getRequestDomain()
  const [settings, tokens, commerce] = await Promise.all([
    getSiteSettings(domain, locale),
    // Scoped to this host so each site gets its own TokenManager (falls back to
    // the most recently published one when no manager lists the domain).
    getTokenMap(locale, domain),
    getCommerceSettings(domain),
  ])
  const navbarStyle  = resolveNavbarStyle(settings?.navbarStyle)

  // Mock storefront — mounted ONLY on sites with ThemeManager enableCommerce.
  // Every other site renders the tree unwrapped and ships no commerce JS.
  const marketCookie = commerce ? await getMarketCookie() : null
  const withCommerce = (node: React.ReactNode) =>
    commerce ? (
      <CommerceProvider catalogId={commerce.catalogId} currency={currencyForLocale(commerce, locale, marketCookie)} locale={locale} market={marketFor(locale, marketCookie)}>
        {node}
      </CommerceProvider>
    ) : node

  // Standalone pages (campaign landing pages) supply their own frame: no header,
  // site search, sidebar rail or site footer. Providers stay so blocks that read
  // the locale, tokens or search context keep working.
  const shellMode = await getShellMode()
  if (shellMode === 'standalone') {
    return withCommerce(
      <TokenProvider tokens={tokens}>
        <LocaleProvider locale={locale}>
          <SearchProvider>
            <div data-nav="standalone" className="contents">
              <ShellModeGuard mode="standalone" />
              <main id="main-content" className="flex-1">{children}</main>
            </div>
          </SearchProvider>
        </LocaleProvider>
      </TokenProvider>
    )
  }

  if (navbarStyle === 'sidebar') {
    return withCommerce(
      <TokenProvider tokens={tokens}>
        <LocaleProvider locale={locale}>
          <SearchProvider>
            {/* data-nav cascades --ot-site-header-h (globals.css) to every consumer
                on the page — e.g. the showcase nav's sticky offset — regardless of
                which nav style is active. display:contents keeps it out of the box
                tree so it can't affect this branch's own layout. */}
            <div data-nav={navbarStyle} className="contents">
              <ShellModeGuard mode="full" />
              <SidebarNav />
              <SiteSearch />
              {commerce && <MiniBag />}
              {/* Content shifts right of the fixed rail. The margin is driven by
                  --ot-sidebar-width (emitted by buildThemeCSS, 0px when not sidebar).
                  On mobile the rail is hidden, so no margin applies below lg. */}
              <div className="ot-sidebar-content flex flex-col min-h-dvh">
                <main id="main-content" className="flex-1">{children}</main>
                <Footer />
                <ScrollToTop />
              </div>
            </div>
          </SearchProvider>
        </LocaleProvider>
      </TokenProvider>
    )
  }

  return withCommerce(
    <TokenProvider tokens={tokens}>
      <LocaleProvider locale={locale}>
        <SearchProvider>
          {/* See data-nav comment above — same cascade, needed here too since
              split-bar's own header already sets it on itself, but top-bar and
              anything below the header (e.g. showcase nav) need it as well. */}
          <div data-nav={navbarStyle} className="contents">
            <ShellModeGuard mode="full" />
            {navbarStyle === 'split-bar' ? <SplitHeader /> : <Header />}
            <SiteSearch />
              {commerce && <MiniBag />}
            <main id="main-content" className="flex-1">{children}</main>
            <Footer />
            <ScrollToTop />
          </div>
        </SearchProvider>
      </LocaleProvider>
    </TokenProvider>
  )
}
