/**
 * Shared `enableExternalPreview` property for every routable page type.
 *
 * When true, the CMS preview shows an External Preview Link panel with a
 * shareable URL (see lib/external-preview.ts) that opens the draft on the live
 * front-end in Next.js draft mode — no CMS login needed for the reviewer.
 *
 * Kept as one definition so every page type pushes an identical property.
 */
export const enableExternalPreviewProperty = {
  type:        'boolean',
  displayName: 'Enable External Preview Link',
  description: 'When enabled, a shareable preview link is generated in the CMS editor so reviewers can view this draft in the live front-end without a CMS login.',
  group:       'OT_Content',
  sortOrder:   5,
} as const
