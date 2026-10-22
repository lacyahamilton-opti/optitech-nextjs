import { rotateVisitorId, setFxAttribute } from '@/lib/fx/browser-client'
import { trackSignIn } from '@/lib/commerce/track'
import type { DemoPersona } from '@/lib/commerce/personas'

/**
 * Identify a signed-in demo persona to ODP and FX (browser only).
 *
 * ODP: zaius.customer() keyed by the persona's example.com email, plus-addressed
 * with a per-demo id (eleanor.marsh+k3f9a2@example.com). Every presenter and
 * browser shares the same three personas, so without the suffix their demos
 * would all pile into three ODP profiles. The id lives in localStorage, so a
 * profile builds up across one demo, and "Reset demo" (localStorage.clear)
 * starts the next one clean. The ODP web SDK's vuid joins the profile to the
 * fs_user_id the FX ODP manager identifies, so the server's
 * fetchQualifiedSegments() sees the persona's ODP segments.
 * FX: `loyalty_tier` goes on the browser user context (events carry it); the
 * server reads the same value from the ot_persona cookie for decide().
 *
 * loyalty_tier / home_city / home_country are custom ODP customer fields
 * (APP-006), listed in ODP_CUSTOMER_FIELDS and printed by `yarn fx:events`.
 */
const DEMO_ID_KEY = 'ot_demo_id'
const DEMO_ID = /^[a-z0-9]{6}$/

let memoryDemoId: string | null = null

/** This browser's demo id (6 chars), created on first use. */
export function getDemoId(): string {
  try {
    const stored = window.localStorage.getItem(DEMO_ID_KEY)
    if (stored && DEMO_ID.test(stored)) return stored
  } catch { /* storage blocked — fall back to memory */ }
  memoryDemoId ??= Math.random().toString(36).slice(2, 8).padEnd(6, '0')
  try { window.localStorage.setItem(DEMO_ID_KEY, memoryDemoId) } catch { /* ignore */ }
  return memoryDemoId
}

/** `name@example.com` → `name+<demoId>@example.com` (the ODP identifier only). */
export function demoEmail(email: string, demoId = getDemoId()): string {
  const at = email.indexOf('@')
  return at > 0 ? `${email.slice(0, at)}+${demoId}${email.slice(at)}` : email
}

export function identifyPersona(p: DemoPersona): void {
  if (typeof window === 'undefined') return
  try {
    window.zaius?.customer(
      { email: demoEmail(p.address.email) },
      {
        first_name:   p.address.firstName,
        last_name:    p.address.lastName,
        loyalty_tier: p.segment,
        home_city:    p.address.city,
        home_country: p.address.country,
      },
    )
  } catch { /* ODP not loaded */ }
  setFxAttribute('loyalty_tier', p.segment)
  trackSignIn(p.segment)
}

/**
 * Sign-out / switch shopper: start a fresh anonymous identity. Without this the
 * browser keeps its ODP vuid and FX user id, and the next sign-in would merge
 * both shoppers into one ODP profile. Bucketing re-rolls — a different shopper
 * is a different user.
 */
export function forgetPersona(): void {
  if (typeof window === 'undefined') return
  try { window.zaius?.anonymize?.() } catch { /* ODP not loaded */ }
  rotateVisitorId()
}
