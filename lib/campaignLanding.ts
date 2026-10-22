import { cache } from 'react'
import { getClient } from '@/lib/optimizely'

const FOOTER_QUERY = `
  query GetCampaignFooter($key: String!, $locale: String) {
    OT_FooterBlock(
      where: { _metadata: { key: { eq: $key }, locale: { eq: $locale } } }
      limit: 1
    ) {
      items {
        _metadata { key locale }
        footerStyle
        footerLogo { url { default } }
        footerLogoSize
        footerLogoInvertDark
        footerLeftMode
        description { html }
        links { label url { default base } }
      }
    }
  }
`

/**
 * The footer block a campaign landing page points at, in the visitor's language
 * with an English fallback. Null when unset or unpublished; the frame then shows
 * its minimal default footer.
 */
/** The footer block record the campaign query returns (fields the Footer component reads). */
export type CampaignFooterRecord = Record<string, unknown>

export const getCampaignFooter = cache(async function getCampaignFooter(key: string, locale: string): Promise<CampaignFooterRecord | null> {
  for (const loc of locale === 'en' ? ['en'] : [locale, 'en']) {
    try {
      const r = (await getClient().request(FOOTER_QUERY, { key, locale: loc })) as { OT_FooterBlock?: { items?: CampaignFooterRecord[] } }
      const item = r?.OT_FooterBlock?.items?.[0]
      if (item) return item
    } catch { /* try the next locale */ }
  }
  return null
})
