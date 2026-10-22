/**
 * First-touch acquisition, captured by proxy.ts into the `ot_acq` cookie on the
 * first page request that carries UTM parameters or an external referrer, and
 * never overwritten for 30 days. Read on the server (FX attributes) and in the
 * browser (purchase tags, warehouse orders).
 *
 * Value: `source~medium~campaign`, each restricted to [A-Za-z0-9._-] so the
 * cookie never needs URL-encoding (an encoded value makes Next emit it twice).
 */
export const ACQ_COOKIE = 'ot_acq'
export const ACQ_MAX_AGE = 60 * 60 * 24 * 30

export type Acquisition = {
  source:   string
  medium:   string
  campaign: string
}

const clip = (v: string | null | undefined) => (v ?? '').replace(/[^\w.-]/g, '').slice(0, 60)

/**
 * Build the cookie value from the request URL, its own host and the referrer,
 * or null when there is nothing to record (no UTM, internal or no referrer).
 */
export function captureAcquisition(url: URL, host: string | null, referrer: string | null): string | null {
  const q = url.searchParams
  let refHost = ''
  try { refHost = referrer ? new URL(referrer).hostname : '' } catch { /* ignore */ }
  const ownHost = (host ?? url.host).split(':')[0]
  const external = !!refHost && refHost !== ownHost
  const source = q.get('utm_source')
  if (!source && !external) return null
  const value = [
    clip(source ?? refHost),
    clip(q.get('utm_medium') ?? (source ? '' : 'referral')),
    clip(q.get('utm_campaign')),
  ]
  return value[0] ? value.join('~') : null
}

export function parseAcquisition(raw: string | null | undefined): Acquisition | null {
  if (!raw) return null
  const [source, medium = '', campaign = ''] = raw.split('~').map(clip)
  return source ? { source, medium, campaign } : null
}

/** Browser: the visitor's first-touch acquisition, if any. */
export function readAcquisition(): Acquisition | null {
  if (typeof document === 'undefined') return null
  const hit = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${ACQ_COOKIE}=`))
  return hit ? parseAcquisition(hit.slice(ACQ_COOKIE.length + 1)) : null
}
