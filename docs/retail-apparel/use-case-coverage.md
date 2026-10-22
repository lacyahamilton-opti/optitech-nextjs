# Retail Apparel: use-case coverage

What the Apple & Ivey demo site supports for each use case in the *Retail Industry Use Case Deck* and each Retail Apparel backlog issue ([APP-001]–[APP-027], #211–#237), and what is still required to demo it.

- **Site:** Apple & Ivey (`retail` application on the dev CMS instance)
- **Branch:** `site-retail-apparel`
- **Status as of:** 1 October 2026

## Status key

| Status | Meaning |
|---|---|
| ✅ Ready | Works in the site today. May benefit from more content, but needs no code or setup. |
| 🛠 Setup | The site code is done. Needs configuration or content in an Optimizely product (FX, Web Experimentation, ODP, CMS, CMP, Opal, OCP, Analytics). |
| ⛔ Blocked | Code is done but waits on an input: BigQuery credentials, or French/German enabled on the CMS instance. |
| 🔧 Code | Still needs code in this repo. |

| | ✅ Ready | 🛠 Setup | ⛔ Blocked | 🔧 Code |
|---|---|---|---|---|
| Deck use cases (25) | 4 | 16 | 4 | 1 |
| Backlog issues (27) | 10 | 15 | 2 | 0 |

The deck rarely names Optimizely products, so the product each use case maps to is a judgement call.

## Deck use cases

| # | Use case | Status | What the site provides | Still required |
|---|---|---|---|---|
| UC-01 | Multi-brand and multi-locale | ⛔ | Language selector with English (US), English (UK), French, German, Spanish. Prices in USD, GBP (UK) and EUR. Size labels per market (US / UK / EU). Product and category text translated into fr/de/es in Graph. | Enable French and German on the CMS instance, then translate pages, navigation and key Journal posts. Single brand only. |
| UC-02 | VIP vs promotional buyers | 🛠 | Demo sign-in identifies the shopper to ODP (tier, city) and passes `loyalty_tier` to FX decisions. Three personas plus "New shopper" at any tier. | ODP segments on `loyalty_tier`; FX audiences; the `pricing` flag. |
| UC-03 | Real-time in-session personalization | 🔧 | Product, bag, checkout, search and recommendation events reach ODP natively and FX as metrics. FX page variations work. | FX audiences / ODP real-time segments (🛠). Re-ordering listings by in-session category interest is not built (🔧). |
| UC-04 | Anonymous personalization (referrer, UTM, device, location) | 🛠 | First-touch UTM / referrer captured in a cookie and passed to FX as `utm_*` attributes. Web Experimentation snippet on the site. | Web Experimentation or FX campaigns targeting these. |
| UC-05 / UC-10 | Next-best product and post-purchase journeys | 🛠 | "Complete the look" and "Next best" recommendations. ODP receives identified customers and orders with line items. | ODP journeys (email / push). Optionally add recommendations to the confirmation page (CMS content). |
| UC-06 | Category pages by segment | 🛠 | Listing pages with editorial tiles, sort and filters; FX content variations per page; `loyalty_tier` attribute. | FX flag + audiences; CMS page variations. |
| UC-07 | Agent-written product descriptions | 🛠 | Product page template has a Product Description field. A template scoped to one product overrides that product's copy (per language) and keeps the default layout. | Opal agent that drafts the description into a product-scoped template for editor approval. |
| UC-08 | Seasonal and trend content | 🛠 | The Orchard campaign page, collection listings, 28 long-form Journal posts. | Opal agent; CMP brief-to-publish workflow. |
| UC-09 | Personalized home and landing pages | 🛠 | FX swaps CMS page variations server-side; segment and UTM attributes available. | FX flag, audiences and CMS variations. |
| UC-10b | Product pages reflect stock and price changes | ✅ | Stock per size, "Only N left", sold-out sizes, was/now prices, badges. Changes appear after the catalog is re-pushed. | — |
| UC-11 | Full-funnel conversion optimization | 🛠 | Home → listing → product → bag → 3-step checkout → confirmation, with events at every step sent to FX, Web Experimentation and ODP. | Create the events in FX and Web Experimentation (FX drops unknown event keys). Experiments. |
| UC-12 | Search and navigation optimization | ✅ | Products in site search and autocomplete (price, image, current language and currency). `search`, `search_no_results` and `filter_apply` events. | Create those events in FX / Web Experimentation to use them as metrics. |
| UC-13 | Dynamic promotions and markdowns | 🛠 | FX `pricing` flag drives discount, was-price and price label on listings, product pages, recommendations, search, wishlist and bag. Off = catalog prices. | Create the `pricing` flag and rules. Bundles and loyalty points are not built. |
| UC-14 | Mobile optimization | 🛠 | Responsive throughout; demo sign-in on the mobile header. | Web Experimentation tests targeting mobile. |
| UC-15 | Price and offer testing | 🛠 | Same `pricing` flag; `purchase` sends revenue in cents for FX revenue metrics. | A/B test on the `pricing` flag. |
| UC-16 | Visibility in AI search answers | ✅ | Product structured data, FAQ markup, answer summaries, `llms.txt`, sitemap with every product page. | — |
| UC-17 | Buying guides and FAQs for AI citation | ✅ | 28 long-form Journal guides with answer summaries; size-and-fit page; FAQ markup. | More guides are optional content work. |
| UC-18 | Competitor AI share-of-voice agent | 🛠 | Nothing needed in the site. | Opal agent. |
| UC-19 | AI content gap agent that updates the CMS | 🛠 | Agent prompt for building CMS pages (`cms/agents/campaign-page-builder.md`). | Opal agent. |
| UC-20 | AI brand visibility report agent | 🛠 | Nothing needed in the site. | Opal scheduled workflow. |
| UC-21 | Plain-language analytics questions | ⛔ | Retail tables (customers, orders, order lines) and a customer-value view in BigQuery; every demo checkout writes its order; 12-month history generator (~8,000 customers, ~20,700 orders). | Add `BQ_SERVICE_ACCOUNT_JSON`, run the history script; then the Opal / Analytics agent. |
| UC-22 | Cross-channel dashboard | ⛔ | Orders carry channel and UTM source / medium / campaign; history covers paid search, paid social, email, organic, AI referral, direct and referral. | BigQuery credentials and seed; Analytics dashboard. |
| UC-23 | Trading decisions from campaign and site data | 🛠 | Featuring a category is a CMS edit; data as UC-21/22. | Depends on UC-21/22 data; Analytics. |
| UC-24 | Marketing-mix visibility | 🛠 | Nothing extra needed in the site. | Analytics and CMP setup. |
| UC-25 | Customer lifetime value by segment | ⛔ | Identified customers and orders with items in ODP; `retail_customer_value` view (orders, revenue, AOV, recency, 3-year value) in BigQuery. | BigQuery credentials and seed; Analytics. |

## Backlog issues

| Issue | Task | Status | Still required |
|---|---|---|---|
| [APP-001](https://github.com/optimizely/sa-demos/issues/211) | Product schema for Graph | ✅ | — (48 products, categories, variants, prices; fr/de/es language versions) |
| [APP-002](https://github.com/optimizely/sa-demos/issues/212) | Scaffold OCP app for product sync | 🛠 | OCP app. The site reads Graph either way. |
| [APP-003](https://github.com/optimizely/sa-demos/issues/213) | Source-to-Graph field mapping and sync | 🛠 | Keep the existing Graph schema; `scripts/catalog/push-catalog.mjs` is the reference mapping (incl. per-language documents). |
| [APP-004](https://github.com/optimizely/sa-demos/issues/214) | OCP error handling and retry | 🛠 | OCP app. |
| [APP-005](https://github.com/optimizely/sa-demos/issues/215) | Graph data QA | ✅ | Re-check after the OCP sync replaces the script push. |
| [APP-006](https://github.com/optimizely/sa-demos/issues/216) | ODP identifiers and attributes | 🛠 | The site sends email and tier at sign-in. Create custom customer fields `loyalty_tier`, `home_city`, `home_country` in ODP. |
| [APP-007](https://github.com/optimizely/sa-demos/issues/217) | VIP and promotional segments | 🛠 | ODP segments built on `loyalty_tier` (each demo creates fresh profiles with no history). |
| [APP-008](https://github.com/optimizely/sa-demos/issues/218) | ODP browser tracking | 🛠 | Native product, order, navigation and account events are sent. Create the custom event type `checkout` in ODP. |
| [APP-009](https://github.com/optimizely/sa-demos/issues/219) | CMS content model | ✅ | — |
| [APP-010](https://github.com/optimizely/sa-demos/issues/220) | Structured content for AI citation | ✅ | — (blog post, answer summary and FAQ blocks) |
| [APP-011](https://github.com/optimizely/sa-demos/issues/221) | CMP seasonal campaigns and workflows | 🛠 | CMP setup; the CMP publish hook already creates Journal drafts. |
| [APP-012](https://github.com/optimizely/sa-demos/issues/222) | Mock content and pages | ✅ | 39 pages, 28 long-form posts, stores, events. French / German versions are tracked under UC-01. |
| [APP-013](https://github.com/optimizely/sa-demos/issues/223) | Product description agent | 🛠 | Opal agent writing to the Product Description field of a product-scoped template. |
| [APP-014](https://github.com/optimizely/sa-demos/issues/224) | AEO gap finder and SOV agents | 🛠 | Opal. |
| [APP-015](https://github.com/optimizely/sa-demos/issues/225) | Natural-language analytics agent | ⛔ | BigQuery credentials and seed; then Opal / Analytics. |
| [APP-016](https://github.com/optimizely/sa-demos/issues/226) | FX flags and variables for pricing | 🛠 | Flag `pricing`: `discount_pct` (integer), `show_compare_at` (boolean), `price_label` (string). |
| [APP-017](https://github.com/optimizely/sa-demos/issues/227) | Audiences for VIP pricing | 🛠 | FX attribute `loyalty_tier` and audiences (or ODP segments). |
| [APP-018](https://github.com/optimizely/sa-demos/issues/228) | Dynamic markdown A/B tests | 🛠 | A/B test on `pricing`; `purchase` revenue metric. |
| [APP-019](https://github.com/optimizely/sa-demos/issues/229) | FX SDK price resolution | ✅ | — (`lib/commerce/pricing.ts`, server-side `decide()`, no flicker) |
| [APP-020](https://github.com/optimizely/sa-demos/issues/230) | PLP queries Graph | ✅ | — |
| [APP-021](https://github.com/optimizely/sa-demos/issues/231) | PDP components and CMS binding | ✅ | — (category / product templates, per-product description) |
| [APP-022](https://github.com/optimizely/sa-demos/issues/232) | Mock basket and checkout | ✅ | — (quick add, bag, checkout, wishlist, personas, "New shopper", Reset demo) |
| [APP-023](https://github.com/optimizely/sa-demos/issues/233) | Next-best-product component | ✅ | — (rule-based; `recs_click` event) |
| [APP-024](https://github.com/optimizely/sa-demos/issues/234) | Full-funnel CRO UI tests | 🛠 | Web Experimentation events and tests. The snippet loads after the page, so visual tests may flicker. |
| [APP-025](https://github.com/optimizely/sa-demos/issues/235) | Anonymous visitor personalization | 🛠 | Web Experimentation / FX campaigns on UTM, referrer, device. |
| [APP-026](https://github.com/optimizely/sa-demos/issues/236) | Connected analytics dashboard | ⛔ | BigQuery credentials and seed; Analytics dashboard. |
| [APP-027](https://github.com/optimizely/sa-demos/issues/237) | End-to-end dry run and QA | 🛠 | After the setup below. |

## Setup checklist

Exact event keys, tags and attributes are printed by:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/fx/print-events.mjs
```

Until each item is set up, the site falls back to today's behaviour (catalog prices, events still reach ODP).

**Feature Experimentation**
- [ ] Custom events for every key marked FX in the checklist (13 storefront events, incl. `purchase` with revenue).
- [ ] Attributes `loyalty_tier`, `utm_source`, `utm_medium`, `utm_campaign`.
- [ ] Flag `pricing` with variables `discount_pct`, `show_compare_at`, `price_label`; rules for VIP pricing and markdown tests.
- [ ] Audiences (e.g. Reserve members, paid-social arrivals).
- [ ] SDK key set on the site's ThemeManager.

**ODP**
- [ ] Custom event type `checkout`.
- [ ] Custom customer fields `loyalty_tier`, `home_city`, `home_country`.
- [ ] VIP / Promotional segments based on `loyalty_tier`.
- [ ] Journeys for next-best product and post-purchase (UC-05 / UC-10).

**Web Experimentation**
- [ ] Custom events with the same keys (Web Exp column in the checklist).
- [ ] CRO and anonymous-personalization campaigns.

**CMS**
- [ ] Enable French and German on the CMS instance.
- [ ] French and German versions of the 39 pages, navigation, footer and key Journal posts.

**BigQuery**
- [ ] Add `BQ_SERVICE_ACCOUNT_JSON` to `.env.local`.
- [ ] Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/analytics/seed-retail-history.mjs` (`--dry` to preview).

**Opal, CMP, OCP, Analytics**
- [ ] Opal agents: product descriptions, AEO gap finder, share of voice, brand visibility, analytics questions.
- [ ] CMP seasonal campaign workflows.
- [ ] OCP product sync app.
- [ ] Analytics dashboards (cross-channel, trading, marketing mix, lifetime value).

## What was built in the site

| Change | What it does | Key files |
|---|---|---|
| Shopper identity | Demo sign-in identifies the shopper to ODP and gives FX the `loyalty_tier` attribute. Each demo gets its own ODP profile (per-demo email suffix); switching shopper starts a fresh identity so profiles never merge. "New shopper" invents a fictitious shopper at any tier. | `lib/commerce/identify.ts`, `lib/commerce/personas.ts`, `components/commerce/PersonaSignIn.tsx` |
| FX pricing | Server-side `decide()` on the `pricing` flag shapes every displayed price. | `lib/commerce/pricing.ts`, `components/commerce/Price.tsx` |
| Event catalog | One list of storefront events sent to FX, Web Experimentation and ODP (native types), with no double counting. | `lib/commerce/events.ts`, `lib/commerce/track.ts`, `scripts/fx/print-events.mjs` |
| Product search | Products in site search and autocomplete, in the page's language and currency. | `lib/catalog.ts`, `app/api/search/route.ts`, `components/search/SiteSearch.tsx` |
| Per-product copy | Product Description field on the product page template, applied per product and language. | `cms/content-types/OT_ProductDetailTemplate.ts`, `lib/commerce/pdp.ts` |
| Acquisition | First-touch UTM / referrer cookie; sent with purchases and as FX attributes. | `lib/acquisition.ts`, `proxy.ts` |
| Retail analytics | BigQuery tables, live order writes, customer-value view, 12-month history generator. | `lib/bq/retail-schema.ts`, `app/api/bq/retail-order/route.ts`, `scripts/analytics/seed-retail-history.mjs` |
| Markets and languages | English (UK) with GBP, local size labels, translated catalog text. | `lib/commerce/market.ts`, `lib/commerce/sizes.ts`, `components/layout/LocaleSelector.tsx`, `data/catalog/apparel.json` |

## Known limits

- Spanish has translated UI and catalog text but no CMS page content.
- Listings are not re-ordered by in-session category interest (UC-03).
- No bundles or loyalty points (UC-13).
- Optimizely Product Recommendations always reports the page type as `home`.
- Web Experimentation loads after the page, so visual tests may flicker.
- Each demo starts with fresh ODP profiles, so behaviour-based segments only reflect that demo; long-run purchase history is in BigQuery.
