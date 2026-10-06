/**
 * Layout options for IndustryNewsFeed — the single typed source for the CMS
 * picklist and the component's layout styles. Adding or renaming a layout
 * touches this constant and the `layoutStyles` map in the component only.
 */
export const layoutOptions = [
  { value: 'default', displayName: 'Default — plain list' },
] as const

export type FeedLayout = (typeof layoutOptions)[number]['value']

export const DEFAULT_FEED_LAYOUT: FeedLayout = layoutOptions[0].value

export function toFeedLayout(v: unknown): FeedLayout {
  return layoutOptions.some(o => o.value === v) ? (v as FeedLayout) : DEFAULT_FEED_LAYOUT
}
