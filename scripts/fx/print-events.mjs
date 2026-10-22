#!/usr/bin/env node
/**
 * Print the storefront event catalog (lib/commerce/events.ts) as a Markdown
 * checklist for setting events up by hand in the Feature Experimentation and
 * Web Experimentation projects, and the custom event types ODP needs.
 *
 *   node scripts/fx/print-events.mjs
 *
 * FX silently drops trackEvent() calls for keys missing from the datafile, so
 * every row marked FX must exist in the site's FX project (same key).
 */
import { ODP_CUSTOMER_FIELDS, RETAIL_EVENTS } from '../../lib/commerce/events.ts'

const rows = Object.entries(RETAIL_EVENTS)
const yes = (b) => (b ? '✓' : '')
const odp = (e) => e.odp.type + (e.odp.action ? ` / ${e.odp.action}` : '')

console.log('## Storefront events\n')
console.log('| Event key | Description | Tags | FX | Web Exp | ODP event (type / action) |')
console.log('|---|---|---|---|---|---|')
for (const [key, e] of rows) {
  console.log(`| \`${key}\` | ${e.description} | ${e.tags.map((t) => `\`${t}\``).join(', ')} | ${yes(e.fx)} | ${yes(e.web)} | ${odp(e)} |`)
}

const STANDARD_ODP = new Set(['product', 'order', 'navigation', 'account'])
const custom = [...new Set(rows.map(([, e]) => e.odp.type).filter((t) => !STANDARD_ODP.has(t)))]
console.log('\n**FX project:** create a custom event for each ✓ in the FX column.')
console.log('`purchase` sends the reserved `revenue` tag as an integer in minor units (cents), so revenue metrics work.')
console.log('\n**Web Experimentation project:** create a custom event with the same key for each ✓ in the Web Exp column.')
console.log(`\n**ODP:** \`product\`, \`order\`, \`navigation\` and \`account\` are standard event types. Custom event type(s) to add: ${custom.map((t) => `\`${t}\``).join(', ') || 'none'}.`)
console.log(`\n**ODP customer fields** (custom, set at demo sign-in): ${ODP_CUSTOMER_FIELDS.map((f) => `\`${f}\``).join(', ')}.`)
console.log('\n**ODP segments:** every demo sign-in creates a fresh profile (email plus-addressed with a per-demo id, e.g. `eleanor.marsh+k3f9a2@example.com`), so it has no order history yet. Build VIP / Promotional segments on the `loyalty_tier` field; in-demo behaviour (views, bag, order) adds on top. Long-run purchase history lives in BigQuery.')
console.log('\n**FX attributes** (create in the FX project):')
console.log('- `loyalty_tier` (string: new | circle | reserve): present while a demo persona is signed in. Use it in audiences such as "Reserve members".')
console.log('- `utm_source`, `utm_medium`, `utm_campaign` (string): first-touch acquisition, present once a visit arrives with UTM tags or from another site.')
console.log('\n**FX flag** `pricing` with variables `discount_pct` (integer), `show_compare_at` (boolean, default true), `price_label` (string). Off or missing = catalog prices.')
