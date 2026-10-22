'use client'

import { useEffect, useRef } from 'react'

/**
 * The Stage look's pointer light. Writes --mx / --my (px) on its own element, which the
 * stylesheet uses as the centre of a radial gradient. Fine pointers only: touch and
 * coarse-pointer devices keep the static overhead beam. Skipped entirely for the
 * Still setting and reduced-motion visitors. Throttled to one write per frame, with
 * the light easing toward the pointer so it trails rather than snaps.
 */
export default function CampaignSpotlight() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const frame = el.closest<HTMLElement>('[data-motion]')
    const off =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(pointer: fine)').matches ||
      frame?.dataset.motion === 'still'
    if (off) return

    let tx = window.innerWidth / 2, ty = window.innerHeight * 0.18
    let x = tx, y = ty, raf = 0
    const ease = frame?.dataset.motion === 'calm' ? 0.06 : 0.14

    const tick = () => {
      x += (tx - x) * ease
      y += (ty - y) * ease
      el.style.setProperty('--mx', `${x.toFixed(1)}px`)
      el.style.setProperty('--my', `${y.toFixed(1)}px`)
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0
    }
    const onMove = (e: PointerEvent) => {
      tx = e.clientX; ty = e.clientY
      if (!raf) raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf) }
  }, [])

  return <div ref={ref} aria-hidden className="ot-cl-spot" />
}
