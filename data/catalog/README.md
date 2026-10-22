# Catalog seed data

One JSON file per storefront catalog, named after the ThemeManager `catalogId`
(e.g. `apparel.json` for the Apple & Ivey retail site).

- **Not read at runtime by default.** Pages read the catalog from the Optimizely
  Graph external source (`ret`). These files are the seed that
  `scripts/catalog/push-catalog.mjs --catalog <id>` validates and pushes there,
  and the later OCP integration replaces that push.
- **Fallback only.** `lib/catalog.ts` lazily loads `<catalogId>.json` when
  `CATALOG_SOURCE=local` or a Graph read fails, so a demo never renders an empty
  store. No site's data is bundled into the shared runtime.
- **Adding a storefront:** add `<id>.json`, run `yarn catalog:push --catalog <id>`,
  and set `enableCommerce` + `catalogId` on that site's ThemeManager. No code changes.
- Images are instance-relative DAM paths (`/globalassets/...`), resolved against
  `OPTIMIZELY_CMS_URL`, so one file works on every CMS instance.
