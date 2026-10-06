/**
 * Normalizes a Rich Text property's `json` value to a parsed object.
 *
 * SDK v3 returns `json` as a serialized string for rich text inside inline
 * content arrays (tab items, slides, feature items), where v2 returned an
 * object. The SDK's own <RichText> parses strings itself, but our adapters
 * treat a string body as plain showcase text, and RichTextBlock/StoryRailSlide
 * walk the node tree — so normalize at the adapter boundary.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function richTextJson(field: { json?: unknown } | null | undefined): any {
  const json = field?.json
  if (typeof json !== 'string') return json ?? undefined
  try {
    return JSON.parse(json)
  } catch {
    return undefined
  }
}
