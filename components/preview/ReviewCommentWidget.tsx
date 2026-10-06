'use client'

/**
 * ReviewCommentWidget
 *
 * Feedback pill + card shown ONLY to external reviewers on a draft page opened
 * via an External Preview Link. Posts to /api/review-comment, which forwards the
 * comment to Mark. Collapsed pill sits bottom-right (DraftStateBanner's pill is
 * bottom-left). Receives no secrets — the webhook URL never reaches the client.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

type Props = {
  contentKey: string
  version:    string
  locale:     string
  path:       string
  title?:     string
}

type Status = 'idle' | 'sending' | 'success' | 'error'

const MAX_COMMENT = 2000
const SESSION_KEY = 'review-comment:reviewer'

const inputClass =
  'w-full bg-canvas text-fg text-body px-sm py-2 min-h-[44px] border border-fg/20 focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand aria-[invalid=true]:border-red-600'

function readSaved(): { name: string; email: string } {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const v = JSON.parse(raw) as { name?: unknown; email?: unknown }
      return {
        name:  typeof v.name  === 'string' ? v.name  : '',
        email: typeof v.email === 'string' ? v.email : '',
      }
    }
  } catch {
    // sessionStorage unavailable — the form works without it
  }
  return { name: '', email: '' }
}

export function ReviewCommentWidget({ contentKey, version, locale, path, title }: Props) {
  const reduce = useReducedMotion()
  const uid    = useId()

  const [open, setOpen]       = useState(false)
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [comment, setComment] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [status, setStatus]   = useState<Status>('idle')
  const [error, setError]     = useState('')

  const pillRef  = useRef<HTMLButtonElement>(null)
  const cardRef  = useRef<HTMLDivElement>(null)
  const nameRef  = useRef<HTMLInputElement>(null)
  const wasOpen  = useRef(false)

  // Restore name/email from sessionStorage when the card is first opened
  // (client-only; done in the click handler, not an effect).
  function openCard() {
    if (!name && !email) {
      const saved = readSaved()
      setName(saved.name)
      setEmail(saved.email)
    }
    setOpen(true)
  }

  // Focus into the card on open; back to the pill on close.
  useEffect(() => {
    if (open) {
      nameRef.current?.focus()
    } else if (wasOpen.current) {
      pillRef.current?.focus()
    }
    wasOpen.current = open
  }, [open])

  // Escape closes from anywhere while open (focus can drop to <body> after a
  // submit, so a handler on the card alone is not enough).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Auto-collapse a few seconds after success.
  useEffect(() => {
    if (status !== 'success') return
    const t = setTimeout(() => setOpen(false), 3000)
    return () => clearTimeout(t)
  }, [status])

  function close() {
    setOpen(false)
    if (status === 'success') setStatus('idle')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    setError('')

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name, email }))
    } catch {
      // ignore — never store the comment text anyway
    }

    try {
      const res = await fetch('/api/review-comment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, comment, website,
          key: contentKey, ver: version, loc: locale, path, title,
        }),
      })
      if (res.ok) {
        setComment('')
        setStatus('success')
        return
      }
      let message = 'Something went wrong. Please try again.'
      try {
        const data = (await res.json()) as { error?: unknown }
        if (typeof data.error === 'string' && data.error) message = data.error
      } catch {
        // non-JSON body — keep the generic message
      }
      setError(message)
      setStatus('error')
    } catch {
      setError('We could not reach the server. Please try again.')
      setStatus('error')
    }
  }

  const ids = {
    name:    `${uid}-name`,
    email:   `${uid}-email`,
    comment: `${uid}-comment`,
    emailHelp: `${uid}-email-help`,
    count:   `${uid}-count`,
    status:  `${uid}-status`,
  }
  const hasError = status === 'error'
  const dur = reduce ? 0 : 0.24

  return (
    <>
      <AnimatePresence initial={false} mode="wait">
        {!open && (
          <motion.button
            key="pill"
            ref={pillRef}
            type="button"
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : 8 }}
            transition={{ ease: [0.25, 1, 0.5, 1], duration: dur }}
            onClick={openCard}
            aria-expanded={false}
            className="fixed bottom-6 right-6 z-[9999] flex items-center gap-sm px-md py-2 min-h-[44px] bg-brand text-fg-on-brand shadow-[0_4px_20px_var(--ot-bloom-brand-faint),0_0_0_1px_var(--ot-bloom-brand-border)] hover:bg-brand-hover transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="text-label uppercase tracking-label font-semibold">Leave feedback</span>
            <MessageSquare className="w-3.5 h-3.5 opacity-70" aria-hidden />
          </motion.button>
        )}

        {open && (
          <motion.div
            key="card"
            ref={cardRef}
            role="dialog"
            aria-label="Leave feedback on this draft"
            initial={{ opacity: 0, y: reduce ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : 12 }}
            transition={{ ease: [0.16, 1, 0.3, 1], duration: dur }}
            className="fixed z-[9999] bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[24rem] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface text-fg border border-fg/12 shadow-[0_8px_40px_oklch(from_var(--ot-fg)_l_c_h/0.18)]"
          >
            <div className="flex items-center justify-between gap-md px-md py-sm border-b border-fg/8">
              <h2 className="text-label uppercase tracking-label font-semibold">Leave feedback</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close feedback form"
                className="min-w-[44px] min-h-[44px] -mr-sm flex items-center justify-center text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-md flex flex-col gap-md" noValidate>
              <div className="flex flex-col gap-xs">
                <label htmlFor={ids.name} className="text-label font-semibold">Name</label>
                <input
                  ref={nameRef}
                  id={ids.name}
                  type="text"
                  required
                  maxLength={80}
                  autoComplete="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  aria-invalid={hasError && !name.trim()}
                  aria-describedby={hasError ? ids.status : undefined}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor={ids.email} className="text-label font-semibold">
                  Email <span className="font-normal text-fg-muted">(optional)</span>
                </label>
                <input
                  id={ids.email}
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  aria-describedby={`${ids.emailHelp}${hasError ? ` ${ids.status}` : ''}`}
                  className={inputClass}
                />
                <p id={ids.emailHelp} className="text-label text-fg-muted">
                  Only used so the author can follow up.
                </p>
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor={ids.comment} className="text-label font-semibold">Comment</label>
                <textarea
                  id={ids.comment}
                  required
                  rows={5}
                  maxLength={MAX_COMMENT}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  aria-invalid={hasError && !comment.trim()}
                  aria-describedby={`${ids.count}${hasError ? ` ${ids.status}` : ''}`}
                  className={`${inputClass} resize-y`}
                />
                <p id={ids.count} className="text-label text-fg-muted text-right tabular-nums">
                  {comment.length} / {MAX_COMMENT}
                </p>
              </div>

              {/* Honeypot — hidden from people and assistive tech; bots fill it. */}
              <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                />
              </div>

              <div id={ids.status} role="status" aria-live="polite" className="text-label min-h-[1.25rem]">
                {status === 'success' && <span className="text-accent">Thanks, your feedback was sent.</span>}
                {status === 'error' && <span className="text-red-600">{error}</span>}
              </div>

              <button
                type="submit"
                aria-disabled={status === 'sending'}
                className="min-h-[44px] px-md py-2 bg-brand text-fg-on-brand text-label uppercase tracking-label font-semibold hover:bg-brand-hover transition-colors aria-disabled:opacity-60 aria-disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {status === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
