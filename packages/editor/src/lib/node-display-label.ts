import type { AnyNode } from '@pascal-app/core'

/**
 * A node's human label, the same in the baked artifact (`extras.label`) and the
 * viewer's breadcrumb: an explicit name wins, items fall back to their catalog
 * asset name, other kinds to a type word.
 */
export function nodeDisplayLabel(node: AnyNode): string {
  if (node.name) return node.name
  switch (node.type) {
    case 'item':
      return (node as { asset?: { name?: string } }).asset?.name || 'Oggetto'
    case 'wall':
      return 'Muro'
    case 'door':
      return 'Porta'
    case 'window':
      return 'Finestra'
    case 'cabinet':
    case 'cabinet-module':
      return 'Mobile'
    case 'slab':
      return 'Solaio'
    case 'ceiling':
      return 'Soffitto'
    case 'roof':
      return 'Tetto'
    case 'fence':
      return 'Recinzione'
    case 'column':
      return 'Pilastro'
    case 'stair':
      return 'Scala'
    default:
      return node.type
  }
}
