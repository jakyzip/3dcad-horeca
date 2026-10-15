import type { CatalogCategory, StructureTool } from '../../../store/use-editor'

export type ToolConfig = {
  id: StructureTool
  iconSrc: string
  label: string
  catalogCategory?: CatalogCategory
}

// Shared structure-tool metadata (icons + labels). The build palette now lives
// in the community Build sidebar; this list survives only as the lookup table
// for cursor/floorplan indicators. Roof-mounted accessories are intentionally
// absent — they're placed from the roof inspector's "Add element" section.
export const tools: ToolConfig[] = [
  { id: 'wall', iconSrc: '/icons/wall.webp', label: 'Muro' },
  { id: 'door', iconSrc: '/icons/door.webp', label: 'Porta' },
  { id: 'window', iconSrc: '/icons/window.webp', label: 'Finestra' },
  { id: 'stair', iconSrc: '/icons/stairs.webp', label: 'Scala' },
  { id: 'roof', iconSrc: '/icons/roof.webp', label: 'Tetto a capanna' },
  { id: 'fence', iconSrc: '/icons/fence.webp', label: 'Recinzione' },
  { id: 'column', iconSrc: '/icons/column.webp', label: 'Pilastro' },
  { id: 'elevator', iconSrc: '/icons/elevator.webp', label: 'Ascensore' },
  { id: 'slab', iconSrc: '/icons/floor.webp', label: 'Solaio' },
  { id: 'ceiling', iconSrc: '/icons/ceiling.webp', label: 'Soffitto' },
  { id: 'zone', iconSrc: '/icons/zone.webp', label: 'Zona' },
  { id: 'spawn', iconSrc: '/icons/spawn-point.webp', label: 'Punto di partenza' },
  { id: 'shelf', iconSrc: '/icons/shelf.webp', label: 'Scaffale' },
  { id: 'duct-segment', iconSrc: '/icons/duct.webp', label: 'Canale' },
  { id: 'duct-fitting', iconSrc: '/icons/duct-fitting.webp', label: 'Raccordo per canale' },
  { id: 'duct-terminal', iconSrc: '/icons/registers.webp', label: 'Bocchetta' },
  { id: 'hvac-equipment', iconSrc: '/icons/HVAC.webp', label: 'Unità HVAC' },
  { id: 'pipe-segment', iconSrc: '/icons/dwv-pipes.webp', label: 'Tubo di scarico' },
  { id: 'pipe-trap', iconSrc: '/icons/dwv-pipes.webp', label: 'Sifone' },
  { id: 'pipe-fitting', iconSrc: '/icons/duct-fitting.webp', label: 'Raccordo per tubo' },
  { id: 'lineset', iconSrc: '/icons/lineset.webp', label: 'Linea frigorifera' },
  { id: 'liquid-line', iconSrc: '/icons/lineset.webp', label: 'Linea del liquido' },
]
