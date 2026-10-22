'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'

/**
 * Sticky bottom call to action for phones. The strip button scrolls out of reach
 * of a thumb on a long page, so the same action is pinned to the bottom edge, then
 * slides away while the form it points at is on screen (no duplicate CTA over the
 * form itself). Hidden at md and up by the stylesheet.
 */
export default function CampaignMobileBar({ label, href, targetId }: { label: string; href: string; targetId?: string }) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!targetId) return
    const target = document.getElementById(targetId)
    if (!target) return
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting), { threshold: 0.15 })
    io.observe(target)
    return () => io.disconnect()
  }, [targetId])

  return (
    // inert takes the off-screen bar out of tab order and the accessibility tree together.
    <div className="ot-cl-mobilebar" data-hidden={hidden} inert={hidden}>
      <Button variant="accent" href={href} className="w-full justify-center">
        {label}
      </Button>
    </div>
  )
}
