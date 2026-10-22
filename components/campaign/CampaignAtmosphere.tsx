import CampaignSpotlight from '@/components/campaign/CampaignSpotlight'
import type { CampaignLook } from '@/lib/campaign-looks'

/**
 * The look's background layers. Purely decorative (aria-hidden), CSS-first: gradients,
 * masks and inline SVG, with a tiny client
 * island only for the Stage pointer light. Everything sits behind the content column
 * (z-0 under z-1) and animates transform / opacity only. All colour comes from the
 * look's tokens, never hard-coded, so the same layers re-colour for every vertical.
 */
export default function CampaignAtmosphere({ look }: { look: CampaignLook }) {
  switch (look) {
    case 'neon':
      // Brick wall (mask recolored from tokens), ambient tube glow, and a fixed neon frame.
      return (
        <>
          <div aria-hidden className="ot-cl-layer">
            <div className="ot-cl-neonwall" />
            <div className="ot-cl-brick" />
            <div className="ot-cl-neonglow" />
          </div>
          <div aria-hidden className="ot-cl-neonframe" />
        </>
      )

    case 'comic':
      // Paper grain only.
      return (
        <div aria-hidden className="ot-cl-layer">
          <div className="ot-cl-paper" />
        </div>
      )

    case 'stage':
      return (
        <>
          <CampaignSpotlight />
          <div aria-hidden className="ot-cl-layer ot-cl-band ot-cl-band--top">
            <div className="ot-cl-glow" />
            <div className="ot-cl-grid" />
          </div>
          <div aria-hidden className="ot-cl-layer">
            <div className="ot-cl-vignette" />
          </div>
        </>
      )

    case 'blueprint':
    default:
      // Drafting grid: 16px minor and 96px major lines, tinted from the look's ink.
      return (
        <div aria-hidden className="ot-cl-layer">
          <div className="ot-cl-bpgrid" />
        </div>
      )
  }
}
