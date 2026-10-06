'use client'

/**
 * ExternalPreviewLinkPanel
 *
 * Shown in the Optimizely CMS preview when any page type has
 * `enableExternalPreview` set to true. Presents a shareable URL that
 * enables Next.js draft mode for an external reviewer — no CMS login needed.
 *
 * Lives at the very top of the preview page, above the site chrome.
 */

import { useRef, useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  url:       string
  headline?: string
  topic?:    string
}

// ─── Copy button ─────────────────────────────────────────────────────────────

/**
 * Copies text to the clipboard. The panel renders inside the CMS editor's
 * cross-origin preview iframe, which isn't granted the `clipboard-write`
 * permission — so navigator.clipboard.writeText rejects there. Fall back to
 * the legacy execCommand('copy') path, which only needs the click's user
 * activation and works inside the iframe.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Blocked by permissions policy — fall through to the legacy path
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top      = '0'
  textarea.style.left     = '0'
  textarea.style.opacity  = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(textarea)
  return ok
}

type CopyState = 'idle' | 'copied' | 'manual'

function CopyButton({ url, onManual }: { url: string; onManual: () => void }) {
  const [state, setState] = useState<CopyState>('idle')

  async function handleCopy() {
    const ok = await copyText(url)
    if (!ok) onManual()
    setState(ok ? 'copied' : 'manual')
    setTimeout(() => setState('idle'), 2500)
  }

  const label = state === 'copied' ? 'Copied' : state === 'manual' ? 'Press ⌘C / Ctrl+C' : 'Copy'

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-xs px-sm py-1 text-label text-fg-muted hover:text-fg border border-fg/12 hover:border-fg/25 transition-colors"
      aria-label={state === 'copied' ? 'Link copied to clipboard' : 'Copy external preview link'}
    >
      {state === 'copied'
        ? <Check className="w-3.5 h-3.5 text-accent" aria-hidden />
        : <Copy  className="w-3.5 h-3.5"             aria-hidden />
      }
      <span aria-live="polite">{label}</span>
    </button>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ExternalPreviewLinkPanel({ url, topic }: Props) {
  const urlRef = useRef<HTMLInputElement>(null)

  // Last resort when both clipboard paths fail: select the URL so the editor
  // can copy it with the keyboard.
  function selectUrl() {
    urlRef.current?.focus()
    urlRef.current?.select()
  }

  return (
    <div className="w-full bg-brand/8 border-b border-brand/15">
      <div className="max-w-screen-xl mx-auto px-lg py-sm flex items-center gap-md flex-wrap min-h-[42px]">

        {/* Label */}
        <div className="flex items-center gap-sm shrink-0">
          {/* Brand bar accent — 2px wide vertical rule */}
          <div className="w-0.5 h-3.5 bg-brand rounded-full" aria-hidden />
          <span className="text-label uppercase tracking-label font-semibold text-brand">
            External Preview Link
          </span>
          {topic && (
            <>
              <span className="text-fg-muted/40" aria-hidden>·</span>
              <span className="text-label text-fg-muted capitalize">{topic}</span>
            </>
          )}
        </div>

        {/* URL — read-only input so it can be selected for manual copy.
            Hidden on very small viewports, shown sm+ */}
        <input
          ref={urlRef}
          type="text"
          readOnly
          value={url}
          onFocus={e => e.currentTarget.select()}
          aria-label="External preview link"
          className="flex-1 min-w-0 hidden sm:block bg-transparent border-0 p-0 text-label font-mono text-fg-muted truncate focus:outline-none focus-visible:text-fg"
        />

        {/* Actions */}
        <div className="flex items-center gap-sm shrink-0 ml-auto sm:ml-0">
          <CopyButton url={url} onManual={selectUrl} />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-xs px-sm py-1 text-label text-fg-muted hover:text-fg border border-fg/12 hover:border-fg/25 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
            <span>Open</span>
          </a>
        </div>

      </div>
    </div>
  )
}
