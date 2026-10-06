import type { TabItemData } from '@/components/blocks/TabsBlock'
import { richTextJson } from '@/lib/richTextJson'

/**
 * Maps one OT_TabItem / OT_TabItemBlock content object into the flat
 * TabItemData shape TabsBlockClient renders. Shared by the array-driven
 * OT_TabsBlock adapter, the standalone OT_TabItemBlock adapter, and
 * cms/compositions/Column.tsx's adjacent-element grouping — all three need
 * the exact same field mapping.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTabItemFromContent(item: any, src: (ref: any) => string | undefined): TabItemData {
  return {
    tabLabel:  String(item?.tabLabel ?? ''),
    tabIcon:   item?.tabIcon         ?? undefined,
    heading:   item?.heading         ?? undefined,
    // CMS delivers rich text as { json }; showcase/mock data passes a plain
    // string or a ready-made imageSrc — accept both shapes.
    body:      richTextJson(item?.body) ?? (typeof item?.body === 'string' ? item.body : undefined),
    imageSrc:  src(item?.image) ?? item?.imageSrc ?? undefined,
    imageAlt:  item?.imageAlt        ?? '',
    ctaLabel:  item?.ctaLabel        ?? undefined,
    ctaUrl:    item?.ctaUrl?.default ?? item?.ctaUrl ?? undefined,
  }
}
