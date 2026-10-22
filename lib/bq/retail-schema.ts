/**
 * Retail analytics tables (storefront demo sites) — BigQuery schemas and the
 * customer-value view. Dependency-free so both the server (lib/bq/retail.ts,
 * live mock-checkout orders) and the history generator
 * (scripts/analytics/seed-retail-history.mjs) share one definition.
 *
 * All rows are synthetic: demo personas (fictitious, no PII), anonymous demo
 * visitors, or generated history (`source = 'seed'`). Money is in major units
 * of the order currency. The banking tables (customer_events /
 * customer_products) are separate and untouched.
 */
export const RETAIL_TABLES = {
  customers: 'retail_customers',
  orders:    'retail_orders',
  lines:     'retail_order_lines',
} as const

export const RETAIL_VALUE_VIEW = 'retail_customer_value'

type Field = { name: string; type: string; mode?: 'REQUIRED' | 'NULLABLE' | 'REPEATED'; description?: string }

export const RETAIL_SCHEMAS: Record<keyof typeof RETAIL_TABLES, { fields: Field[]; partitionField: string; clustering: string[] }> = {
  customers: {
    partitionField: 'created_at',
    clustering: ['customer_id'],
    fields: [
      { name: 'customer_id',          type: 'STRING',    mode: 'REQUIRED', description: 'persona-<id>-<demoId>, shopper-<demoId>, visitor-<id> or c-<n> (seed)' },
      { name: 'loyalty_tier',         type: 'STRING',    description: 'new | circle | reserve' },
      { name: 'home_city',            type: 'STRING' },
      { name: 'home_country',         type: 'STRING' },
      { name: 'acquisition_channel',  type: 'STRING',    description: 'organic | paid_search | paid_social | email | ai_referral | direct | referral' },
      { name: 'acquisition_source',   type: 'STRING' },
      { name: 'acquisition_campaign', type: 'STRING' },
      { name: 'first_seen_at',        type: 'TIMESTAMP' },
      { name: 'created_at',           type: 'TIMESTAMP', mode: 'REQUIRED', description: 'row (snapshot) time; the view uses the latest per customer' },
      { name: 'source',               type: 'STRING',    mode: 'REQUIRED', description: 'seed | live' },
    ],
  },
  orders: {
    partitionField: 'placed_at',
    clustering: ['customer_id', 'channel'],
    fields: [
      { name: 'order_id',             type: 'STRING',    mode: 'REQUIRED' },
      { name: 'customer_id',          type: 'STRING',    mode: 'REQUIRED' },
      { name: 'placed_at',            type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'currency',             type: 'STRING',    mode: 'REQUIRED' },
      { name: 'subtotal',             type: 'FLOAT64' },
      { name: 'discount',             type: 'FLOAT64',   description: 'promotional discount in the order (FX price treatments, markdown tests)' },
      { name: 'shipping',             type: 'FLOAT64' },
      { name: 'total',                type: 'FLOAT64' },
      { name: 'item_count',           type: 'INT64' },
      { name: 'delivery',             type: 'STRING',    description: 'standard | express | collect' },
      { name: 'store_city',           type: 'STRING',    description: 'boutique for click-and-collect' },
      { name: 'channel',              type: 'STRING',    description: 'marketing channel of the session that ordered' },
      { name: 'utm_source',           type: 'STRING' },
      { name: 'utm_medium',           type: 'STRING' },
      { name: 'utm_campaign',         type: 'STRING' },
      { name: 'device',               type: 'STRING',    description: 'mobile | desktop | tablet' },
      { name: 'loyalty_tier',         type: 'STRING',    description: 'tier at the time of the order' },
      { name: 'price_treatment',      type: 'STRING',    description: 'FX pricing label / variation seen, if any' },
      { name: 'source',               type: 'STRING',    mode: 'REQUIRED' },
    ],
  },
  lines: {
    partitionField: 'placed_at',
    clustering: ['category', 'product_id'],
    fields: [
      { name: 'order_id',             type: 'STRING',    mode: 'REQUIRED' },
      { name: 'customer_id',          type: 'STRING',    mode: 'REQUIRED' },
      { name: 'placed_at',            type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'sku',                  type: 'STRING',    mode: 'REQUIRED' },
      { name: 'product_id',           type: 'STRING',    mode: 'REQUIRED', description: 'catalog handle' },
      { name: 'product_name',         type: 'STRING' },
      { name: 'category',             type: 'STRING',    description: 'primary catalog category handle' },
      { name: 'gender',               type: 'STRING' },
      { name: 'collection',           type: 'STRING' },
      { name: 'size',                 type: 'STRING' },
      { name: 'colour',               type: 'STRING' },
      { name: 'quantity',             type: 'INT64' },
      { name: 'unit_price',           type: 'FLOAT64' },
      { name: 'line_total',           type: 'FLOAT64' },
      { name: 'unit_cost',            type: 'FLOAT64',   description: 'synthetic landed cost' },
      { name: 'margin',               type: 'FLOAT64',   description: 'line_total − unit_cost × quantity' },
      { name: 'currency',             type: 'STRING' },
      { name: 'source',               type: 'STRING',    mode: 'REQUIRED' },
    ],
  },
}

/** Synthetic landed-cost ratio by top-level category (premium apparel margins). */
export const COST_RATIO: Record<string, number> = { women: 0.36, men: 0.36, accessories: 0.42 }

/** Customer value per customer: orders, revenue, AOV, recency and a simple 3-year value. */
export function retailValueViewSql(project: string, dataset: string): string {
  const t = (name: string) => `\`${project}.${dataset}.${name}\``
  return `
    CREATE OR REPLACE VIEW ${t(RETAIL_VALUE_VIEW)} AS
    WITH latest AS (
      SELECT * EXCEPT(rn) FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn
        FROM ${t(RETAIL_TABLES.customers)}
      ) WHERE rn = 1
    ),
    orders AS (
      SELECT
        customer_id,
        COUNT(*)                                  AS orders,
        SUM(total)                                AS revenue,
        AVG(total)                                AS aov,
        MIN(placed_at)                            AS first_order_at,
        MAX(placed_at)                            AS last_order_at,
        ANY_VALUE(currency)                       AS currency
      FROM ${t(RETAIL_TABLES.orders)}
      GROUP BY customer_id
    )
    SELECT
      c.customer_id, c.loyalty_tier, c.home_city, c.home_country,
      c.acquisition_channel, c.acquisition_source, c.acquisition_campaign, c.first_seen_at, c.source,
      o.orders, o.revenue, o.aov, o.currency, o.first_order_at, o.last_order_at,
      DATE_DIFF(CURRENT_DATE(), DATE(o.last_order_at), DAY) AS days_since_last_order,
      -- Simple 3-year value: observed order rate (per year, ≥ 1 order) × AOV × 3.
      ROUND(o.aov * GREATEST(o.orders / GREATEST(DATE_DIFF(CURRENT_DATE(), DATE(o.first_order_at), DAY) / 365.0, 0.25), 1) * 3, 2) AS predicted_3y_value
    FROM latest c JOIN orders o USING (customer_id)
  `
}
