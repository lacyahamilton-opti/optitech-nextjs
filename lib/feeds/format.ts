/** Format a feed date for display. `dateOnly` omits the time. Returns '' for null/invalid. */
export function formatFeedDate(iso: string | null, dateOnly: boolean, locale?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(locale, dateOnly
      ? { dateStyle: 'medium', timeZone: 'UTC' }
      : { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' },
    ).format(d)
  } catch {
    return ''
  }
}
