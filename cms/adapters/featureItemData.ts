import type { FeatureItem } from '@/components/blocks/FeatureTile'
import { richTextJson } from '@/lib/richTextJson'

export function resolveUrl(v: unknown): string | undefined {
  if (!v) return undefined
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v !== null && 'default' in v) return String((v as Record<string, unknown>).default)
  return undefined
}

/**
 * Maps one OT_FeatureItemBlock content object into the FeatureItem shape
 * FeatureTile renders. Shared by the standalone OT_FeatureItemBlock adapter
 * and the column-grouped OT_FeatureItemGroup adapter.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildFeatureItemFromContent(content: any): FeatureItem {
  return {
    headline: String(content?.headline ?? ''),
    body:     richTextJson(content?.body),
    ctaLabel: content?.ctaLabel ?? undefined,
    ctaUrl:   resolveUrl(content?.ctaUrl),
    icon:     content?.icon ?? undefined,
  }
}
