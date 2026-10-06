export type SearchResult = {
  id: string
  title: string
  url: string
  type: 'Blog' | 'Page' | 'Event' | 'Location' | 'Practitioner'
  topic?: string
  published?: string
  excerpt?: string
  imageUrl?: string
  /** Event-only fields — present when type === 'Event'. */
  eventType?: string
  startDate?: string
  endDate?: string
  locationType?: string
  locationLabel?: string
  /** Location-only fields — present when type === 'Location'. */
  address?: string
  locationBadge?: string
  /** Practitioner-only fields — present when type === 'Practitioner'. */
  credentials?: string
  practitionerTitle?: string
  /** Opaque URL returned by Content Graph for click-through hit tracking. Fire
   *  a GET request to this URL when the user navigates to the result. */
  _track?: string | null
}

// ─── Autocomplete ───────────────────────────────────────────────────────────
// Typeahead suggestions are a single _Content fulltext query (see
// app/api/search/autocomplete/route.ts) classified into the same three
// buckets the results list and filter drawer use, so the typeahead panel can
// group them and offer a "View all <type>" link per group.

export type AutocompleteType = 'Blog' | 'Event' | 'Page'

export type AutocompleteSuggestion = {
  label: string
  type:  AutocompleteType
  url:   string
}
