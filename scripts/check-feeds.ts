/**
 * check-feeds — runs every enabled registry entry through the same
 * safeFetchFeed + normalizer the app uses. Exit 1 if any enabled feed returns
 * no items or its newest item is older than 30 days.
 *
 *   yarn check:feeds            # enabled feeds only
 *   yarn check:feeds --all      # include disabled alternatives (informational)
 */
import { FEED_REGISTRY } from '../lib/feeds/registry'
import { safeFetchFeed, FeedFetchError } from '../lib/feeds/safeFetch'
import { normalizeFeed } from '../lib/feeds/normalize'

const MAX_AGE_MS = 30 * 24 * 3600 * 1000
const includeDisabled = process.argv.includes('--all')

async function main(): Promise<void> {
  let failed = false
  for (const entry of FEED_REGISTRY) {
    if (!entry.enabled && !includeDisabled) continue
    const tag = entry.enabled ? '' : ' (disabled — informational)'
    try {
      const res = await safeFetchFeed(entry)
      const { format, items, warnings } = normalizeFeed(res.body)
      const dates = items.map(i => i.date).filter((d): d is string => !!d).sort()
      const newest = dates.at(-1) ?? null
      const imgPct = items.length ? Math.round((items.filter(i => i.image).length / items.length) * 100) : 0
      const stale = !newest || Date.now() - new Date(newest).getTime() > MAX_AGE_MS
      const bad = items.length === 0 || stale
      if (bad && entry.enabled) failed = true
      console.log(
        `${bad ? 'FAIL' : 'OK  '} ${entry.id.padEnd(17)} http=${res.status} format=${format} items=${items.length} ` +
        `newest=${newest ?? 'n/a'} images=${imgPct}% warnings=${warnings.length ? warnings.join(',') : 'none'}${tag}`,
      )
    } catch (err) {
      if (entry.enabled) failed = true
      const code = err instanceof FeedFetchError ? `${err.code}${err.status ? `(${err.status})` : ''}` : 'unknown'
      console.log(`FAIL ${entry.id.padEnd(17)} fetch error: ${code}${tag}`)
    }
  }
  process.exitCode = failed ? 1 : 0
}

main()
