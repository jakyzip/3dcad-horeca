import type { AssetInput } from '@pascal-app/core'

/**
 * A catalog tile: the asset plus optional editor placement metadata.
 * `tool` names the placement tool the tile arms (defaults to the generic
 * `'item'` drop tool) — kinds drawn by their own registry tool (e.g. the
 * modular cabinet) point at that tool id instead.
 */
export type CatalogItem = AssetInput & { tool?: string }

// Empty on purpose: the upstream entries pointed at Pascal's hosted models,
// which have no documented license. Add items only with a row in ASSETS.md.
export const CATALOG_ITEMS: CatalogItem[] = []

export function getDefaultCatalogItem(category: string | null | undefined): AssetInput | null {
  if (!category) return null
  return CATALOG_ITEMS.find((item) => item.category === category) ?? null
}
