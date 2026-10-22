/**
 * Retail analytics writes (live mock-checkout orders). Server-only. Tables and
 * the customer-value view are created on first use; see lib/bq/retail-schema.ts.
 */
import 'server-only'
import { getBigQuery } from './client'
import { streamingInsertWithRetry } from './events'
import { RETAIL_SCHEMAS, RETAIL_TABLES, retailValueViewSql } from './retail-schema'

let ensured: Promise<void> | null = null

export function ensureRetailTables(): Promise<void> {
  ensured ??= (async () => {
    const env = getBigQuery()
    if (!env) throw new Error('BigQuery not configured')
    const dataset = env.bq.dataset(env.datasetId)
    const [datasetExists] = await dataset.exists()
    if (!datasetExists) throw new Error(`Dataset "${env.datasetId}" does not exist in project ${env.projectId}`)
    for (const [key, name] of Object.entries(RETAIL_TABLES) as [keyof typeof RETAIL_TABLES, string][]) {
      const [exists] = await dataset.table(name).exists()
      if (exists) continue
      const s = RETAIL_SCHEMAS[key]
      await dataset.createTable(name, {
        schema: { fields: s.fields },
        timePartitioning: { type: 'DAY', field: s.partitionField },
        clustering: { fields: s.clustering },
      })
    }
    await env.bq.query({ query: retailValueViewSql(env.projectId, env.datasetId) })
  })().catch((e) => { ensured = null; throw e })
  return ensured
}

export type RetailRows = {
  customer: Record<string, unknown>
  order:    Record<string, unknown>
  lines:    Record<string, unknown>[]
}

export async function insertRetailOrder(rows: RetailRows): Promise<void> {
  const env = getBigQuery()
  if (!env) throw new Error('BigQuery not configured')
  await ensureRetailTables()
  const ds = env.bq.dataset(env.datasetId)
  await streamingInsertWithRetry(() => ds.table(RETAIL_TABLES.customers).insert([rows.customer]))
  await streamingInsertWithRetry(() => ds.table(RETAIL_TABLES.orders).insert([rows.order]))
  if (rows.lines.length) await streamingInsertWithRetry(() => ds.table(RETAIL_TABLES.lines).insert(rows.lines))
}
