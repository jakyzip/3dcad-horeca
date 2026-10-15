import { describe, expect, test } from 'bun:test'
import { EQUIPMENT_DEFINITIONS } from './definitions'
import { label3dText } from './labels'
import type { EquipmentNode } from './schema'

const node = (patch: Partial<EquipmentNode>) => ({ metadata: {}, ...patch }) as EquipmentNode
const ITEM_ID = '0b9d6a2e-4c1f-4f3a-9a57-2f4c8e1d7b60'

describe('label3dText', () => {
  test('article name first, then node name, then the kind', () => {
    const product = { item_id: ITEM_ID, code: 'MT-01', name: 'Mantecatore 12 kg' }
    expect(label3dText(node({ name: 'Mio', metadata: { product } }), 'Mantecatore')).toBe(
      'Mantecatore 12 kg',
    )
    expect(label3dText(node({ name: ' Mio ' }), 'Mantecatore')).toBe('Mio')
    expect(label3dText(node({}), 'Mantecatore')).toBe('Mantecatore')
  })

  test('a local article without a name falls back', () => {
    const product = { item_id: '', code: 'LOC-1', name: '' }
    expect(label3dText(node({ metadata: { product } }), 'Tavolo')).toBe('Tavolo')
  })
})

test('every equipment kind mounts a 3D label system', () => {
  for (const def of EQUIPMENT_DEFINITIONS) expect(def.system).toBeDefined()
})
