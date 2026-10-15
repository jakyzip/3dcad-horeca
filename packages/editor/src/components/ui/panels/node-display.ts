import { type AnyNode, scriptImages } from '@pascal-app/core'

export type NodeDisplay = {
  icon: string
  label: string
}

const TYPE_DEFAULTS: Record<string, NodeDisplay> = {
  item: { icon: '/icons/item.webp', label: 'Oggetto' },
  wall: { icon: '/icons/wall.webp', label: 'Muro' },
  door: { icon: '/icons/door.webp', label: 'Porta' },
  window: { icon: '/icons/window.webp', label: 'Finestra' },
  slab: { icon: '/icons/floor.webp', label: 'Solaio' },
  ceiling: { icon: '/icons/ceiling.webp', label: 'Soffitto' },
  column: { icon: '/icons/column.webp', label: 'Pilastro' },
  elevator: { icon: '/icons/elevator.webp', label: 'Ascensore' },
  fence: { icon: '/icons/fence.webp', label: 'Recinzione' },
  roof: { icon: '/icons/roof.webp', label: 'Tetto' },
  'roof-segment': { icon: '/icons/roof.webp', label: 'Falda' },
  stair: { icon: '/icons/stairs.webp', label: 'Scala' },
  'stair-segment': { icon: '/icons/stairs.webp', label: 'Rampa' },
  scan: { icon: '/icons/mesh.webp', label: 'Scansione 3D' },
  guide: { icon: '/icons/floorplan.webp', label: 'Immagine di riferimento' },
  zone: { icon: '/icons/zone.webp', label: 'Zona' },
}

export function getTypeDisplay(type: string): NodeDisplay {
  return TYPE_DEFAULTS[type] ?? { icon: '/icons/select.webp', label: type }
}

export function getNodeDisplay(node: AnyNode | null | undefined): NodeDisplay {
  if (!node) return { icon: '/icons/select.webp', label: 'Selezione' }
  const fallback = TYPE_DEFAULTS[node.type] ?? { icon: '/icons/select.webp', label: node.type }
  const scripted = scriptImages(node)?.thumbnail
  // Item nodes carry an asset with its own thumbnail/name
  if (node.type === 'item') {
    return {
      icon: scripted ?? (node.asset?.thumbnail || fallback.icon),
      label: node.name || node.asset?.name || fallback.label,
    }
  }
  if (node.type === 'zone' && node.spaceRole === 'room') {
    return { icon: '/icons/kitchen.webp', label: node.name || 'Stanza' }
  }
  return {
    icon: scripted ?? fallback.icon,
    label: node.name || fallback.label,
  }
}
