export type FeedItem = {
  /** guid / id / link, stable */
  id:       string
  /** plain text */
  title:    string
  /** validated http(s) URL */
  link:     string
  /** plain text, truncated (~220 chars, word boundary); '' when absent */
  summary:  string
  /** ISO 8601 UTC or null */
  date:     string | null
  /** true when the feed gives no meaningful time of day */
  dateOnly: boolean
  image?:   { url: string; alt: string }
}

export type FeedSource = {
  id:         string
  label:      string
  name:       string
  homepage:   string
}

/** Normalized payload returned by the service and the API route. */
export type FeedPayload = {
  source: FeedSource
  items:  FeedItem[]
}

/** Server-side result: `unavailable` means no fresh and no last-good data. */
export type FeedResult =
  | { status: 'ok'; payload: FeedPayload }
  | { status: 'unavailable'; source: FeedSource }
