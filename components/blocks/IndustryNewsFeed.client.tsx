'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Feed thumbnail. If the image fails to load the whole frame is removed so the
 * item falls back to its no-image layout. The mount check covers errors that
 * fire before hydration attaches onError.
 */
export default function FeedImage({ src, frameClassName, imgClassName }: {
  src:            string
  frameClassName?: string
  imgClassName?:   string
}) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el && el.complete && el.naturalWidth === 0) setFailed(true)
  }, [])

  if (failed) return null
  return (
    <div className={frameClassName} data-feed-image>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote publisher hosts; no wildcard remotePatterns */}
      <img
        ref={ref}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={imgClassName}
      />
    </div>
  )
}
