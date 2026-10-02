'use client'

/**
 * ReviewCommentsPanel
 *
 * Client half of ReviewCommentsStrip. For the CMS author: a floating pill
 * (bottom-right, mirroring the reviewer's ReviewCommentWidget) that opens a
 * docked card of external reviewer comments. Floating rather than inline so it
 * never shifts the page being reviewed. The card shows a corner "New" ribbon
 * when anything arrived today and friendly viewer-local timestamps.
 *
 * Time-dependent output (ribbon, "Today at…") renders only after hydration:
 * the server doesn't know the viewer's timezone or what "today" is.
 */

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Mail, MessageSquare, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

export type PanelComment = {
  id:          string
  name:        string
  email?:      string
  comment:     string
  ver:         string
  path:        string
  submittedAt: string
}

type Props = { comments: PanelComment[] }

// ── "now", ticking once a minute; null on the server ─────────────────────────

function subscribeMinute(cb: () => void) {
  const t = setInterval(cb, 60_000)
  return () => clearInterval(t)
}
const minuteNow = (): number | null => Math.floor(Date.now() / 60_000) * 60_000
const serverNow = (): number | null => null

// ── Friendly dates ───────────────────────────────────────────────────────────

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(b) - startOfDay(a)) / 86_400_000)

function friendlyTime(iso: string, now: number): string {
  const t    = new Date(iso)
  const diff = now - t.getTime()
  if (Number.isNaN(diff)) return ''
  if (diff < 60_000)    return 'Just now'
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000)
    return `${m} minute${m === 1 ? '' : 's'} ago`
  }
  const time = t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const days = dayDiff(t, new Date(now))
  if (days <= 0) return `Today at ${time}`
  if (days === 1) return `Yesterday at ${time}`
  if (days < 7)  return `${t.toLocaleDateString(undefined, { weekday: 'long' })} at ${time}`
  const sameYear = t.getFullYear() === new Date(now).getFullYear()
  const date = t.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }),
  })
  return `${date} at ${time}`
}

const fullTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })

const isToday = (iso: string, now: number | null) =>
  now !== null && dayDiff(new Date(iso), new Date(now)) === 0

// ── Small pieces ─────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = (parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0] ?? '?'])
    .map(p => Array.from(p)[0] ?? '')
  return letters.join('').toUpperCase()
}

function mailtoHref(email: string, path: string) {
  const to = encodeURIComponent(email).replace(/%40/g, '@')
  return `mailto:${to}?subject=${encodeURIComponent(`Re: your feedback on ${path}`)}`
}

const chip =
  'inline-flex items-center px-1.5 py-0.5 text-label font-semibold leading-none border border-fg/15 text-fg-muted rounded-ot-control'

function NewChip() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-label font-semibold uppercase tracking-label leading-none bg-brand text-fg-on-brand rounded-ot-control">
      New
    </span>
  )
}

function CommentItem({ c, now, showNew }: { c: PanelComment; now: number | null; showNew: boolean }) {
  return (
    <li className="flex gap-md py-md border-t border-fg/8 first:border-t-0 first:pt-0 last:pb-0">
      <span
        className="shrink-0 w-9 h-9 rounded-full bg-brand/15 text-fg flex items-center justify-center text-label font-semibold"
        aria-hidden
      >
        {initials(c.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-sm gap-y-1">
          <span className="font-semibold text-fg">{c.name}</span>
          {showNew && isToday(c.submittedAt, now) && <NewChip />}
          <time dateTime={c.submittedAt} title={fullTime(c.submittedAt)} className="text-label text-fg-muted">
            {now !== null ? friendlyTime(c.submittedAt, now) : ''}
          </time>
          {c.ver && <span className={chip}>v{c.ver}</span>}
        </div>
        <p className="mt-1 text-body text-fg whitespace-pre-wrap break-words">{c.comment}</p>
        {c.email && (
          <a
            href={mailtoHref(c.email, c.path)}
            aria-label={`Reply to ${c.name} by email`}
            className="mt-1 -ml-2 px-2 min-h-[44px] inline-flex items-center gap-xs text-label font-semibold text-fg underline underline-offset-4 decoration-brand hover:decoration-2 focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Mail className="w-3.5 h-3.5" aria-hidden />
            Reply
            <span className="font-normal text-fg-muted no-underline break-all">· {c.email}</span>
          </a>
        )}
      </div>
    </li>
  )
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function ReviewCommentsPanel({ comments }: Props) {
  const reduce = useReducedMotion()
  const cardId = useId()
  const now    = useSyncExternalStore(subscribeMinute, minuteNow, serverNow)

  const [open, setOpen] = useState(false)
  const pillRef  = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpen  = useRef(false)

  const count      = comments.length
  const freshCount = comments.filter(c => isToday(c.submittedAt, now)).length
  const hasFresh   = freshCount > 0
  // Per-comment chips only help when the thread mixes old and new comments.
  const mixed      = hasFresh && freshCount < count

  // Focus into the card on open; back to the pill on close.
  useEffect(() => {
    if (open) closeRef.current?.focus()
    else if (wasOpen.current) pillRef.current?.focus()
    wasOpen.current = open
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const dur = reduce ? 0 : 0.2

  return (
    <AnimatePresence initial={false} mode="wait">
      {!open ? (
        <motion.button
          key="pill"
          ref={pillRef}
          type="button"
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : 8 }}
          transition={{ ease: [0.25, 1, 0.5, 1], duration: dur }}
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls={cardId}
          className="fixed bottom-6 right-6 z-[9999] flex items-center gap-sm px-md py-2 min-h-[44px] bg-brand text-fg-on-brand shadow-[0_4px_20px_var(--ot-bloom-brand-faint),0_0_0_1px_var(--ot-bloom-brand-border)] hover:bg-brand-hover transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <MessageSquare className="w-3.5 h-3.5 opacity-70" aria-hidden />
          <span className="text-label uppercase tracking-label font-semibold">Feedback</span>
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-label font-semibold leading-none bg-fg-on-brand text-brand rounded-ot-control">
            {count}
          </span>
          {hasFresh && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-fg-on-brand" aria-hidden />
              <span className="sr-only">new feedback today</span>
            </>
          )}
        </motion.button>
      ) : (
        <motion.div
          key="card"
          id={cardId}
          role="dialog"
          aria-label="Reviewer feedback"
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : 12 }}
          transition={{ ease: [0.16, 1, 0.3, 1], duration: dur }}
          className="fixed z-[9999] bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[26rem] max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-surface text-fg border border-fg/12 rounded-ot-surface shadow-[0_8px_40px_oklch(from_var(--ot-fg)_l_c_h/0.18)]"
        >
          {/* Corner ribbon: only when something arrived today */}
          {hasFresh && (
            <div className="pointer-events-none absolute left-0 top-0 w-[76px] h-[76px] overflow-hidden" aria-hidden>
              <span className="absolute left-[-28px] top-[15px] w-[116px] -rotate-45 py-0.5 text-center text-label font-semibold uppercase tracking-label leading-none bg-brand text-fg-on-brand shadow-[0_2px_6px_oklch(from_var(--ot-fg)_l_c_h/0.25)]">
                New
              </span>
            </div>
          )}

          <div className={`flex items-center gap-sm pr-sm py-xs border-b border-fg/8 ${hasFresh ? 'pl-[3.75rem]' : 'pl-md'}`}>
            <h2 className="text-label font-semibold uppercase tracking-label">
              Reviewer feedback
              {hasFresh && <span className="sr-only"> (new feedback today)</span>}
            </h2>
            <span className={chip}>{count}</span>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close reviewer feedback"
              className="ml-auto min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-muted hover:text-fg transition-colors focus-visible:outline-2 focus-visible:outline-brand"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>

          <ul className="overflow-y-auto overscroll-contain p-md">
            {comments.map(c => <CommentItem key={c.id} c={c} now={now} showNew={mixed} />)}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
