/**
 * Shared canvas/surface/brand/brandDeep/accent → token mapping. Several block
 * components (Banner, Slider, …) offer the same five-color choice for a solid
 * fill; this is the single source of truth for that mapping so the
 * color-to-class logic isn't rebuilt per block (see OT_SliderBlock-requirements.md §6).
 */

export type OtColor = 'canvas' | 'surface' | 'brand' | 'brandDeep' | 'accent'

/** Solid Tailwind fill class for each color token. */
export const OT_COLOR_FILL_CLASS: Record<OtColor, string> = {
  canvas:    'bg-canvas',
  surface:   'bg-surface',
  brand:     'bg-brand',
  brandDeep: 'bg-brand-hover',
  accent:    'bg-accent',
}

/** The CSS custom property backing each color token, for relative-color syntax
 *  (e.g. `oklch(from var(--ot-brand) l c h / 0.4)`). */
export const OT_COLOR_VAR: Record<OtColor, string> = {
  canvas:    'var(--ot-canvas)',
  surface:   'var(--ot-surface)',
  brand:     'var(--ot-brand)',
  brandDeep: 'var(--ot-brand-hover)',
  accent:    'var(--ot-accent)',
}
