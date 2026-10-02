import { notFound } from 'next/navigation'
import { draftMode } from 'next/headers'
import { getLocalizedContentByPath, getRequestBaseUrl, getRequestLocale } from '@/lib/optimizely'
import { withAppContext } from '@optimizely/cms-sdk/react/server'
import { NextPreviewComponent } from '@optimizely/cms-sdk/react/nextjs'
import { CompositionRenderer } from '@/lib/CompositionRenderer'
import Script from 'next/script'
import CmsPage from './[...slug]/page'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function HomePage({ searchParams }: Props) {
  const cmsUrl  = (process.env.OPTIMIZELY_CMS_URL ?? '').replace(/\/$/, '')
  const dm      = await draftMode()

  // Draft/preview requests for "/" (CMS preview, External Preview Links) go
  // through the same renderer as every other page so they get the real draft
  // content and the preview chrome (draft banner, link panel, review widget).
  // Without a preview_token a stale draft cookie falls through to published.
  const sp = await searchParams
  if (dm.isEnabled && typeof sp.preview_token === 'string' && sp.preview_token) {
    return <CmsPage params={Promise.resolve({ slug: [] })} searchParams={searchParams} />
  }

  const baseUrl = await getRequestBaseUrl()
  const locale  = await getRequestLocale()

  // Try root path first; fall back to common CMS home slugs.
  // '/home' is the Optimizely CMS convention; '/base-home' is the OTBase default slug.
  let exp: any
  for (const path of ['/', '/home', '/base-home']) {
    exp = await getLocalizedContentByPath(path, locale, baseUrl)
    if (exp?.composition?.nodes) break
  }

  if (!exp?.composition?.nodes) notFound()

  return (
    <>
      {dm.isEnabled && cmsUrl && (
        <Script src={`${cmsUrl}/util/javascript/communicationinjector.js`} />
      )}
      {dm.isEnabled && <NextPreviewComponent />}
      <CompositionRenderer nodes={exp.composition.nodes} />
    </>
  )
}

export default withAppContext(HomePage)
