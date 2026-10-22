import { type NextRequest, NextResponse } from 'next/server'
import { getCmpAccessToken, cmpConfigured } from '@/lib/cmpApi'
import { getClient } from '@/lib/optimizely'

// Shape consumed by TopicHubPage DocRow and DocResult type
type DocResult = {
  id:        string
  title:     string
  url:       string
  extension: string | null
  fileSize:  number | null
}

// ─── CMP folder search ────────────────────────────────────────────────────────
// Fetches all assets in a CMP folder, title-scores by query, returns top-N.
// The CMP API exposes `folder_id` as a filter; Content Graph's _AssetItem has
// no folder filter, so folder-scoped doc search must go through the CMP API.

interface CmpAsset {
  id:             string
  title?:         string
  is_archived?:   boolean
  file_extension?: string | null
  content?:       { type: string; value: string }
}

interface CmpAssetsResponse {
  data?: CmpAsset[]
}

function titleScore(title: string, q: string): number {
  const t = title.toLowerCase()
  const ql = q.toLowerCase()
  if (t === ql) return 4
  if (t.startsWith(ql)) return 3
  if (t.includes(ql)) return 2
  const terms = ql.split(/\s+/).filter(Boolean)
  if (!terms.length) return 0
  const hits = terms.filter(term => t.includes(term)).length
  return hits / terms.length
}

async function searchCmpFolder(
  q: string,
  folderId: string,
  limit: number,
): Promise<DocResult[]> {
  const token = await getCmpAccessToken()
  const url = `https://api.cmp.optimizely.com/v3/assets?folder_id=${encodeURIComponent(folderId)}&include_subfolder_assets=true&page_size=100`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`CMP folder fetch failed: ${res.status}`)

  const body = (await res.json()) as CmpAssetsResponse
  const assets = body.data ?? []

  const scored = assets
    .filter(a => !a.is_archived && a.content?.value)
    .map(a => ({ a, score: titleScore(a.title ?? '', q) }))
    .filter(({ score }) => score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)

  return scored.map(({ a }) => ({
    id:        a.id,
    title:     a.title ?? '',
    url:       a.content!.value,
    extension: a.file_extension ?? null,
    fileSize:  null,
  }))
}

// ─── Graph fallback (no folder scope) ────────────────────────────────────────
// Used when no folderId is provided or CMP credentials are absent.

const DOCS_GRAPH_QUERY = `
  query SearchDocs($query: String!, $limit: Int!) {
    _AssetItem(
      orderBy: { _ranking: RELEVANCE }
      where: { _fulltext: { match: $query, fuzzy: true } }
      limit: $limit
    ) {
      items {
        _itemMetadata { key displayName }
        _assetMetadata { fileSize mimeType url }
      }
    }
  }
`

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf':     'pdf',
  'application/msword':  'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'video/mp4':  'mp4',
}

// Mime type first, then the file extension on the URL or title, so unmapped types never read as PDF.
function resolveExtension(mimeType: string | undefined, url: string, title: string): string | null {
  if (mimeType && MIME_TO_EXT[mimeType]) return MIME_TO_EXT[mimeType]
  const fromName = (s: string) => s.split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() ?? null
  return fromName(url) ?? fromName(title)
}

async function searchGraphDocs(q: string, limit: number): Promise<DocResult[]> {
  const data = await getClient().request(DOCS_GRAPH_QUERY, { query: q, limit })
  const items: any[] = (data as any)?._AssetItem?.items ?? []
  return items.map((item: any) => {
    const title = item._itemMetadata?.displayName ?? 'Untitled'
    const url   = item._assetMetadata?.url ?? ''
    return {
      id:        item._itemMetadata?.key ?? '',
      title,
      url,
      extension: resolveExtension(item._assetMetadata?.mimeType, url, title),
      fileSize:  item._assetMetadata?.fileSize ?? null,
    }
  })
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q        = (searchParams.get('q') ?? '').trim()
  const folderId = searchParams.get('folderId')?.trim()
  const limit    = 12

  if (q.length < 2) return NextResponse.json([])

  // Folder-scoped search via CMP API (primary path for Topic Hub doc buckets).
  // If CMP IS configured and the call fails, return empty — don't fall through
  // to the unscoped Graph query (which returns assets from all sites).
  // If CMP is NOT configured (no credentials in env), fall through to Graph so
  // editors still see some results without needing CMP set up.
  if (folderId && cmpConfigured()) {
    try {
      const results = await searchCmpFolder(q, folderId, limit)
      return NextResponse.json(results)
    } catch (err) {
      console.error('[search/docs] CMP folder search failed:', err)
      return NextResponse.json([])
    }
  }

  // A folder was requested but CMP credentials are missing: return nothing rather than
  // silently ignoring the folder and listing assets from every site.
  if (folderId) {
    console.warn('[search/docs] folderId supplied but CMP_CLIENT_ID / CMP_CLIENT_SECRET are not set; returning no results')
    return NextResponse.json([])
  }

  // No folderId — Graph fulltext across all accessible assets. Leaving DAM Folder ID
  // blank in the CMS is the explicit opt-in for this unscoped mode.
  try {
    const results = await searchGraphDocs(q, limit)
    return NextResponse.json(results)
  } catch (err) {
    console.error('[search/docs] Graph docs search failed:', err)
    return NextResponse.json([])
  }
}
