export type ParsedDate = {
  iso:         string
  /** the source carried a time-of-day */
  hasTime:     boolean
  /** source wall-clock time is exactly 00:00:00 or 12:00:00 (placeholder stamp) */
  nominalTime: boolean
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

const ZONES: Record<string, number> = {
  ut: 0, utc: 0, gmt: 0, z: 0,
  est: -300, edt: -240, cst: -360, cdt: -300, mst: -420, mdt: -360, pst: -480, pdt: -420,
}

function build(y: number, mo: number, d: number, h: number, mi: number, s: number, offsetMin: number, hasTime: boolean): ParsedDate | null {
  if (y < 1990 || y > 2100 || mo < 0 || mo > 11 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return null
  const probe = new Date(Date.UTC(y, mo, d))
  if (probe.getUTCMonth() !== mo || probe.getUTCDate() !== d) return null // e.g. 31 Feb
  const ms = Date.UTC(y, mo, d, h, mi, s) - offsetMin * 60_000
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return null
  const nominal = !hasTime || (mi === 0 && s === 0 && (h === 0 || h === 12))
  return { iso: date.toISOString(), hasTime, nominalTime: nominal }
}

function parseOffset(zone: string | undefined): number | null {
  if (!zone) return 0
  const num = /^([+-])(\d{2}):?(\d{2})$/.exec(zone)
  if (num) return (num[1] === '-' ? -1 : 1) * (parseInt(num[2], 10) * 60 + parseInt(num[3], 10))
  const named = ZONES[zone.toLowerCase()]
  return named === undefined ? null : named
}

/**
 * Parses RFC 822 (numeric + named zones), ISO 8601, and NIH's
 * `Mon, 09/14/2026 - 11:00` (no zone → treated as UTC). Returns null on failure.
 */
export function parseFeedDate(input: unknown): ParsedDate | null {
  if (typeof input !== 'string') return null
  const s = input.trim()
  if (!s || s.length > 64) return null

  // ISO 8601
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(s)
  if (m) {
    const hasTime = m[4] !== undefined
    const off = parseOffset(m[7]?.toUpperCase())
    if (off === null) return null
    return build(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), off, hasTime)
  }

  // NIH: "Mon, 09/14/2026 - 11:00"
  m = /^(?:[A-Za-z]{3},?\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*-\s*(\d{1,2}):(\d{2}))?$/.exec(s)
  if (m) {
    const hasTime = m[4] !== undefined
    return build(+m[3], +m[1] - 1, +m[2], +(m[4] ?? 0), +(m[5] ?? 0), 0, 0, hasTime)
  }

  // RFC 822 / 2822
  m = /^(?:[A-Za-z]{3,9},?\s*)?(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*([+-]\d{4}|[A-Za-z]{1,4})?$/.exec(s)
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()]
    if (mo === undefined) return null
    let y = +m[3]
    if (m[3].length === 2) y += y < 50 ? 2000 : 1900
    const hasTime = m[4] !== undefined
    const off = parseOffset(m[7])
    if (off === null) return null
    return build(y, mo, +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), off, hasTime)
  }

  return null
}
