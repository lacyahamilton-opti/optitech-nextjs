/**
 * lib/campaign-looks.ts
 *
 * The look model for OT_CampaignLandingPage. A "look" is a preset identity the
 * editor picks on the page; each look fixes its own mode (dark / light / drenched),
 * so there is deliberately no separate light/dark field.
 *
 * Pure and CMS-agnostic. The CSS for each look lives in
 * components/campaign/campaign-looks.css and reads the attributes this file
 * resolves (data-look, data-motion, data-fill) plus one inline variable, --cl-seed.
 *
 * Contrast strategy: every look pins its fills to fixed OKLCH lightness steps and
 * only takes HUE and a clamped CHROMA from the seed. Text on a fill therefore has a
 * known contrast no matter what color the editor or the site supplies. 
 */

export const CAMPAIGN_LOOKS = ['blueprint', 'neon', 'comic', 'stage'] as const
export type CampaignLook = (typeof CAMPAIGN_LOOKS)[number]
export const DEFAULT_CAMPAIGN_LOOK: CampaignLook = 'blueprint'

export const CAMPAIGN_MOTION_LEVELS = ['full', 'calm', 'still'] as const
export type CampaignMotion = (typeof CAMPAIGN_MOTION_LEVELS)[number]
export const DEFAULT_CAMPAIGN_MOTION: CampaignMotion = 'full'

/** Color mode each look renders in (becomes the frame's data-theme). */
export const LOOK_MODE: Record<CampaignLook, 'dark' | 'light'> = {
  blueprint: 'light',
  neon:      'dark',
  comic:     'light',
  stage:     'dark',
}

export function resolveLook(value: string | null | undefined): CampaignLook {
  return (CAMPAIGN_LOOKS as readonly string[]).includes(value ?? '')
    ? (value as CampaignLook)
    : DEFAULT_CAMPAIGN_LOOK
}

export function resolveMotion(value: string | null | undefined): CampaignMotion {
  return (CAMPAIGN_MOTION_LEVELS as readonly string[]).includes(value ?? '')
    ? (value as CampaignMotion)
    : DEFAULT_CAMPAIGN_MOTION
}

/**
 * Validates an editor-typed hex ("#c7b289", "c7b289", "#fb0") and normalises it to
 * "#rrggbb". Anything else returns null, so a typo falls back to the site color
 * instead of injecting arbitrary text into a style attribute.
 */
export function sanitizeHex(value: string | null | undefined): string | null {
  const v = (value ?? '').trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(v)) return `#${v.split('').map(c => c + c).join('').toLowerCase()}`
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toLowerCase()}`
  return null
}

/** OKLCH chroma of a "#rrggbb" string (0 for greys). */
function hexChroma(hex: string): number {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(1 + i, 3 + i), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = [lin(0), lin(2), lin(4)]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return Math.hypot(a, bb)
}

/**
 * The editor's override, if it can seed a palette. A grey (#333, #999) has no hue, so
 * every look would invent one (a clay-pink in practice); ignore it and use the site's own
 * color instead.
 */
export function usableOverride(value: string | null | undefined): string | null {
  const hex = sanitizeHex(value)
  return hex && hexChroma(hex) >= 0.04 ? hex : null
}

export type CampaignAppearance = {
  look:   CampaignLook
  motion: CampaignMotion
  /** data-theme for the frame: re-scopes every theme token to the right mode. */
  theme:  'dark' | 'light'
  /** The color every look derives its palette from. Valid CSS color. */
  seed:   string
  /** Second palette color (Comic and Neon pairing). The site accent when the
      editor has not overridden the seed, else the seed's hue rotated 140 degrees. */
  seed2:  string
}

/**
 * Resolves the page's appearance from the editor's fields and the site's colors.
 * Seed priority: valid accent override, then the site brand, then the site accent, then
 * the brand token the site renders by default.
 */
export function resolveCampaignAppearance(input: {
  look?:           string | null
  motion?:         string | null
  accentOverride?: string | null
  siteAccent?:     string | null
  siteBrand?:      string | null
}): CampaignAppearance {
  const look   = resolveLook(input.look)
  const motion = resolveMotion(input.motion)
  const seed =
    usableOverride(input.accentOverride) ??
    (input.siteBrand?.trim() || null) ??
    (input.siteAccent?.trim() || null) ??
    // No ThemeManager colors (e.g. a fresh localhost): defer to whatever brand color the
    // site renders by default, so the look always matches the rest of its own site. This
    // reads --cl-site-brand, captured by the frame on a wrapper ABOVE the look scope:
    // pointing at var(--ot-brand) directly would be circular, since each look redefines it.
    'var(--cl-site-brand)'

  const theme = LOOK_MODE[look]
  const override = usableOverride(input.accentOverride)
  // Without an override the pairing is the site's own accent (or the token default captured
  // by the frame); with an override the editor chose a one-off hue, so rotate it instead.
  const seed2    = override
    ? 'oklch(from var(--cl-seed) l c calc(h + 140))'
    : (input.siteAccent?.trim() || 'var(--cl-site-accent)')
  return { look, motion, theme, seed, seed2 }
}
