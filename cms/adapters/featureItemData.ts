import type { FeatureItem } from '@/components/blocks/FeatureTile'
import { richTextJson } from '@/lib/richTextJson'
import { resolveCmsUrl } from '@/lib/resolveCmsUrl'

export function resolveUrl(v: unknown): string | undefined {
  return resolveCmsUrl(v as Parameters<typeof resolveCmsUrl>[0])
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
