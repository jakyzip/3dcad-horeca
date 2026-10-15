import type { CatalogCategory } from './../../../store/use-editor'

export type FurnishToolConfig = {
  id: 'item'
  iconSrc: string
  label: string
  catalogCategory: CatalogCategory
}

export const furnishTools: FurnishToolConfig[] = [
  { id: 'item', iconSrc: '/icons/couch.webp', label: 'Arredi', catalogCategory: 'furniture' },
  { id: 'item', iconSrc: '/icons/appliance.webp', label: 'Elettrodomestici', catalogCategory: 'appliance' },
  { id: 'item', iconSrc: '/icons/kitchen.webp', label: 'Cucina', catalogCategory: 'kitchen' },
  { id: 'item', iconSrc: '/icons/bathroom.webp', label: 'Bagno', catalogCategory: 'bathroom' },
  { id: 'item', iconSrc: '/icons/tree.webp', label: 'Esterno', catalogCategory: 'outdoor' },
]
