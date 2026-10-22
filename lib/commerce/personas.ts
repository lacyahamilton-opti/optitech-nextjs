import type { OrderAddress } from '@/lib/commerce/types'

/**
 * Fictitious demo shoppers for the mock storefront's "Sign in" picker.
 *
 * Demo-site rules these follow:
 *  - Invented people on the reserved example.com domain (RFC 2606) with
 *    made-up addresses — never real PII.
 *  - Only the `segment` leaves the profile (as the ot_persona cookie) so
 *    personalisation can target "circle" / "reserve" without knowing who.
 *  - Signing in pre-fills checkout and identifies the shopper to ODP under a
 *    per-demo address (lib/commerce/identify.ts), so demos never share a
 *    profile. The global demo reset signs out.
 */
export type PersonaSegment = 'new' | 'circle' | 'reserve'

export type DemoPersona = {
  id:       string
  segment:  PersonaSegment
  initials: string
  address:  OrderAddress
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'jordan', segment: 'new', initials: 'JA',
    address: { firstName: 'Jordan', lastName: 'Avery', email: 'jordan.avery@example.com', line1: '418 Hudson Street, Apt 5C', city: 'New York, NY', postcode: '10014', country: 'United States' },
  },
  {
    id: 'priya', segment: 'circle', initials: 'PS',
    address: { firstName: 'Priya', lastName: 'Shah', email: 'priya.shah@example.com', line1: '2150 N Clark Street', city: 'Chicago, IL', postcode: '60614', country: 'United States' },
  },
  {
    id: 'eleanor', segment: 'reserve', initials: 'EM',
    address: { firstName: 'Eleanor', lastName: 'Marsh', email: 'eleanor.marsh@example.com', line1: '14 Chiltern Street', city: 'London', postcode: 'W1U 7PZ', country: 'United Kingdom' },
  },
]

export const DEFAULT_PERSONA_ID = 'jordan'

export function getPersona(id: string | null | undefined): DemoPersona | null {
  return DEMO_PERSONAS.find((p) => p.id === id) ?? null
}

export const PERSONA_SEGMENTS: PersonaSegment[] = ['new', 'circle', 'reserve']

/**
 * "New shopper": a fictitious person generated on the fly (sign-in menu), so a
 * presenter can show a brand-new profile being created and qualifying for a
 * segment. Same rules as the fixed personas — invented names, example.com,
 * made-up street addresses in the boutique cities.
 */
export const SHOPPER_ID = 'shopper'

const FIRST_NAMES = ['Amara', 'Theo', 'Ines', 'Callum', 'Mei', 'Lucas', 'Freya', 'Mateo', 'Nadia', 'Oscar', 'Zara', 'Henrik', 'Leila', 'Rafael', 'Imogen', 'Kenji']
const LAST_NAMES  = ['Cole', 'Hartley', 'Moreau', 'Lindqvist', 'Bennett', 'Okoro', 'Castell', 'Whitmore', 'Varga', 'Ashby', 'Delacroix', 'Morrow', 'Sato', 'Fenwick', 'Ruiz', 'Quinn']

/** Boutique cities (seed history uses the same set). Shared with /api/bq/retail-order for validation. */
export const SHOPPER_HOMES: Pick<OrderAddress, 'line1' | 'city' | 'postcode' | 'country'>[] = [
  { line1: '27 Bond Street, Apt 3',  city: 'New York, NY',    postcode: '10012',    country: 'United States' },
  { line1: '1140 Abbot Kinney Blvd', city: 'Los Angeles, CA', postcode: '90291',    country: 'United States' },
  { line1: '845 W Armitage Avenue',  city: 'Chicago, IL',     postcode: '60614',    country: 'United States' },
  { line1: '9 Marylebone Lane',      city: 'London',          postcode: 'W1U 2HG',  country: 'United Kingdom' },
  { line1: '18 rue de Saintonge',    city: 'Paris',           postcode: '75003',    country: 'France' },
]

function pick<T>(xs: readonly T[]): T { return xs[Math.floor(Math.random() * xs.length)] }

export function makeRandomShopper(segment?: PersonaSegment): DemoPersona {
  const firstName = pick(FIRST_NAMES), lastName = pick(LAST_NAMES)
  return {
    id: SHOPPER_ID,
    segment: segment ?? pick(PERSONA_SEGMENTS),
    initials: `${firstName[0]}${lastName[0]}`,
    address: { firstName, lastName, email: `${firstName}.${lastName}@example.com`.toLowerCase(), ...pick(SHOPPER_HOMES) },
  }
}

/** Loose shape check for a generated shopper read back from storage. */
export function isShopper(v: unknown): v is DemoPersona {
  const p = v as DemoPersona | null
  return !!p && p.id === SHOPPER_ID && PERSONA_SEGMENTS.includes(p.segment) && typeof p.address?.email === 'string'
}

/** The signed-in persona: a fixed demo persona, or the generated shopper. */
export function currentPersona(state: { persona: string | null; shopper?: DemoPersona | null }): DemoPersona | null {
  return state.persona === SHOPPER_ID ? state.shopper ?? null : getPersona(state.persona)
}

/** The published mock test card (CheckoutView accepts only this). */
export const TEST_CARD = { number: '4242 4242 4242 4242', expiry: '12/29', cvc: '123' }
