/** Text cleaning for untrusted feed content. Output is always plain text. */

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä',
  euro: '€', pound: '£', yen: '¥', cent: '¢', deg: '°', times: '×', ensp: ' ', emsp: ' ', thinsp: ' ',
}

const ENTITY_RE = /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,10}));/g

function fromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return ''
  if (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) return ''
  return String.fromCodePoint(cp)
}

/** Single-pass entity decode (named subset + numeric). Unknown entities are left as-is. */
export function decodeEntities(input: string): string {
  return input.replace(ENTITY_RE, (m, dec, hex, name) => {
    if (dec) return fromCodePoint(parseInt(dec, 10))
    if (hex) return fromCodePoint(parseInt(hex, 16))
    const v = NAMED[name] ?? NAMED[String(name).toLowerCase()]
    return v ?? m
  })
}

function stripMarkup(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    // block-level boundaries become spaces so words don't fuse
    .replace(/<\/?[a-zA-Z!][^>]*>/g, ' ')
}

/**
 * Raw XML text node → plain text.
 * The XML parser runs with entity processing OFF, so a description holding
 * escaped HTML arrives as `&lt;p&gt;…`. We decode, strip tags/comments, decode
 * again (handles double-encoded `&amp;nbsp;`), repeating up to 3 passes until
 * stable, so the result can never contain tag-like content.
 */
export function cleanText(raw: unknown): string {
  if (typeof raw !== 'string' || raw === '') return ''
  let s = raw
  for (let i = 0; i < 4; i++) {
    const next = stripMarkup(decodeEntities(s))
    if (next === s) break
    s = next
  }
  return s.replace(/\s+/g, ' ').trim()
}

/** Decode markup-bearing text into raw HTML (for image extraction only; never rendered). */
export function toRawHtml(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let s = decodeEntities(raw)
  if (!/<img\b/i.test(s) && /&lt;img\b/i.test(s)) s = decodeEntities(s)
  return s
}

/** Truncate on a word boundary, adding an ellipsis. */
export function truncateWords(text: string, max = 220): string {
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const sp = slice.lastIndexOf(' ')
  const cut = sp > max * 0.5 ? slice.slice(0, sp) : slice
  return cut.replace(/[\s,;:.\-–—]+$/, '') + '…'
}
