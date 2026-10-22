'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, RotateCcw, UserRound, UserRoundPlus } from 'lucide-react'
import { useCommerce } from '@/components/commerce/CommerceProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { currentPersona, DEMO_PERSONAS, PERSONA_SEGMENTS, SHOPPER_ID, type PersonaSegment } from '@/lib/commerce/personas'
import { resetDemoState } from '@/lib/demo/state'
import type { MessageKey } from '@/lib/i18n/t'

const iconBtn =
  'relative flex items-center justify-center gap-1.5 h-9 min-w-9 px-1 text-fg hover:text-brand ' +
  'transition-colors duration-150 ease-quick ' +
  'focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2'

/**
 * Demo "Sign in" for the mock storefront: a disclosure menu that switches
 * between fictitious shoppers (lib/commerce/personas.ts), or invents a new one
 * at a chosen tier. Signing in pre-fills checkout, sets the segment cookie for
 * personalisation and identifies the shopper to ODP under a per-demo address
 * (lib/commerce/identify.ts). Renders nothing outside a CommerceProvider.
 */
export default function PersonaSignIn() {
  const { t } = useTranslation()
  const { enabled, state, signIn, signInAsNewShopper, signOut } = useCommerce()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  if (!enabled) return null
  const persona = state.hydrated ? currentPersona(state) : null

  const close = () => { setOpen(false); buttonRef.current?.focus() }
  const choose = (id: string | null) => {
    if (id) signIn(id)
    else signOut()
    close()
  }
  const invent = (segment: PersonaSegment) => { signInAsNewShopper(segment); close() }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={persona ? t('commerce.hiName', { name: persona.address.firstName }) : t('commerce.signIn')}
        className={iconBtn}
      >
        {persona ? (
          <span aria-hidden className="flex h-7 w-7 items-center justify-center bg-brand text-[0.6875rem] font-semibold tracking-label text-fg-on-brand">
            {persona.initials}
          </span>
        ) : (
          <UserRound size={20} strokeWidth={1.75} aria-hidden />
        )}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-[calc(100%+0.5rem)] z-60 w-72 border border-fg/10 bg-surface p-sm text-left shadow-[0_12px_40px_var(--ot-bloom-brand-faint)]"
      >
        <p className="px-xs pt-xs text-label font-semibold uppercase tracking-label text-fg">
          {persona ? t('commerce.hiName', { name: persona.address.firstName }) : t('commerce.signInTitle')}
        </p>
        <p className="px-xs pb-sm pt-1 text-xs text-fg-muted">{t('commerce.signInHint')}</p>
        <ul className="flex flex-col">
          {DEMO_PERSONAS.map((p) => {
            const current = persona?.id === p.id
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => choose(p.id)}
                  aria-current={current || undefined}
                  className="flex w-full items-center gap-sm px-xs py-xs text-left hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span aria-hidden className="flex h-8 w-8 flex-none items-center justify-center bg-brand/10 text-xs font-semibold text-fg">{p.initials}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-fg">{p.address.firstName} {p.address.lastName}</span>
                    <span className="text-xs text-fg-muted">{t(`commerce.segment_${p.segment}` as MessageKey)}</span>
                  </span>
                  {current && <Check size={16} aria-hidden className="ml-auto text-fg" />}
                </button>
              </li>
            )
          })}
          {persona?.id === SHOPPER_ID && (
            <li className="flex items-center gap-sm px-xs py-xs" aria-current>
              <span aria-hidden className="flex h-8 w-8 flex-none items-center justify-center bg-brand/10 text-xs font-semibold text-fg">{persona.initials}</span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-fg">{persona.address.firstName} {persona.address.lastName}</span>
                <span className="text-xs text-fg-muted">{t(`commerce.segment_${persona.segment}` as MessageKey)}</span>
              </span>
              <Check size={16} aria-hidden className="ml-auto text-fg" />
            </li>
          )}
        </ul>
        <div className="mt-xs border-t border-fg/10 px-xs pt-sm" role="group" aria-labelledby={`${panelId}-new`}>
          <p id={`${panelId}-new`} className="flex items-center gap-xs text-sm font-medium text-fg">
            <UserRoundPlus size={14} aria-hidden />
            {t('commerce.newShopper')}
          </p>
          <p className="pt-0.5 text-xs text-fg-muted">{t('commerce.newShopperHint')}</p>
          <div className="flex flex-wrap gap-xs pt-xs">
            {PERSONA_SEGMENTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => invent(s)}
                title={t(`commerce.segment_${s}` as MessageKey)}
                className="border border-fg/15 px-sm py-1 text-xs text-fg transition-colors duration-150 ease-quick hover:border-fg/40 hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-brand"
              >
                {t(`commerce.tier_${s}` as MessageKey)}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => choose(null)}
          className="mt-xs w-full border-t border-fg/10 px-xs pt-sm text-left text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          {persona ? t('commerce.signOut') : t('commerce.continueAsGuest')}
        </button>
        <button
          type="button"
          onClick={() => { resetDemoState(); window.location.reload() }}
          title={t('commerce.resetDemoHint')}
          className="mt-xs flex w-full items-center gap-xs px-xs pb-xs text-left text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          <RotateCcw size={12} aria-hidden />
          {t('commerce.resetDemo')}
        </button>
      </div>
    </div>
  )
}
