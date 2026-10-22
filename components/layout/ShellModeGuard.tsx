'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const KEY = 'ot-shell-reload'

/**
 * The site layout chooses between the full shell and the bare standalone shell,
 * but Next.js keeps a layout mounted across client-side navigations, so crossing
 * between a standalone page (campaign landing) and a normal page would keep the
 * wrong shell until a manual refresh. This compares the layout's mode with the page
 * that actually rendered (standalone frames carry data-ot-standalone) and does one
 * hard reload on a mismatch so the layout re-decides. A sessionStorage stamp stops
 * it ever looping if the two disagree for another reason.
 */
export default function ShellModeGuard({ mode }: { mode: 'full' | 'standalone' }) {
  const pathname = usePathname()

  useEffect(() => {
    const pageIsStandalone = !!document.querySelector('[data-ot-standalone]')
    if (pageIsStandalone === (mode === 'standalone')) return
    try {
      const last = sessionStorage.getItem(KEY)
      const now = Date.now()
      if (last && now - Number(last.split('|')[1]) < 5000 && last.split('|')[0] === pathname) return
      sessionStorage.setItem(KEY, `${pathname}|${now}`)
    } catch { /* storage unavailable: still reload once */ }
    window.location.reload()
  }, [pathname, mode])

  return null
}
