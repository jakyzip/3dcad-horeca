/** Collections a scene commonly needs, each with its default name and colour. */
export const COLLECTION_TEMPLATES = {
  lights: { name: 'Luci', color: '#f5b83d' },
  windows: { name: 'Finestre', color: '#5aa9e6' },
  doors: { name: 'Porte', color: '#a0714f' },
  electrical: { name: 'Impianto elettrico', color: '#e5533d' },
  plumbing: { name: 'Impianto idraulico', color: '#2f80c2' },
  framing: { name: 'Orditura', color: '#c9a36a' },
  masonry: { name: 'Muratura', color: '#b5653f' },
  roof: { name: 'Tetto', color: '#6b6f7a' },
  cabinetry: { name: 'Mobili', color: '#8a6bbf' },
  'kitchen-cabinetry': { name: 'Mobili della cucina', color: '#4fae7f' },
} as const

export type CollectionTemplateId = keyof typeof COLLECTION_TEMPLATES

export const COLLECTION_TEMPLATE_IDS = Object.keys(COLLECTION_TEMPLATES) as [
  CollectionTemplateId,
  ...CollectionTemplateId[],
]
