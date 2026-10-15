import { describe, expect, test } from 'bun:test'
import {
  composizioneDa,
  composizioniFromFile,
  composizioniToFile,
  elementiIn,
  FILE_FORMAT,
} from './composizioni'
import type { EquipmentNode } from './schema'

const unit = (id: string, x: number, z: number, extra: Record<string, unknown> = {}) =>
  ({
    id,
    type: 'horeca:lavello',
    name: `Unità ${id}`,
    position: [x, 0, z],
    rotation: Math.PI / 2,
    width: 1.2,
    depth: 0.7,
    height: 0.9,
    elevation: 0,
    parentId: 'level_a',
    metadata: {
      product: { item_id: '', code: 'LAV-120', name: 'Lavello' },
      allacciamenti: [{ tipo: 'scarico', lato: 'retro', distanza: 0.6, altezza: 0.4, quota: true }],
      nodeSelectionProxyId: 'x',
    },
    ...extra,
  }) as unknown as EquipmentNode

describe('compositions', () => {
  const comp = composizioneDa(
    [
      unit('a', 2, 1),
      unit('b', 4, 1.6, { type: 'horeca:pensile', elevation: 1.5, gocciolatoio: true }),
    ],
    '  Zona lavaggio ',
    new Date('2026-10-15T10:00:00Z'),
  )!

  test('relative offsets around the centre; Ho.Re.Ca data kept, scene data dropped', () => {
    expect(comp.nome).toBe('Zona lavaggio')
    expect(comp.elementi.map((e) => e.offset)).toEqual([
      [-1, -0.3],
      [1, 0.3],
    ])
    const [lavello, pensile] = comp.elementi
    expect(Object.keys(lavello!.metadata).sort()).toEqual(['allacciamenti', 'product'])
    expect(pensile).toMatchObject({ type: 'horeca:pensile', elevation: 1.5, gocciolatoio: true })
    expect('id' in lavello! || 'parentId' in lavello!).toBe(false)
  })

  test('placed around a new centre, with copies of the metadata', () => {
    const [a] = elementiIn(comp, [10, 20])
    expect(a!.position).toEqual([9, 0, 19.7])
    expect(a!.rotation).toBeCloseTo(Math.PI / 2)
    ;(a!.metadata as { product: { code: string } }).product.code = 'CHANGED'
    expect((comp.elementi[0]!.metadata.product as { code: string }).code).toBe('LAV-120')
  })

  test('nothing selected or no name: no composition', () => {
    expect(composizioneDa([], 'X')).toBeNull()
    expect(composizioneDa([unit('a', 0, 0)], '  ')).toBeNull()
  })

  test('file round trip with fresh ids; bad entries counted, other files refused', () => {
    const text = composizioniToFile([comp, { ...comp, elementi: [] }])
    const { composizioni, scartate } = composizioniFromFile(text)
    expect(composizioni).toHaveLength(1)
    expect(scartate).toBe(1)
    expect(composizioni[0]!.id).not.toBe(comp.id)
    expect(composizioni[0]!.elementi).toEqual(comp.elementi)
    expect(() => composizioniFromFile('{"format":"altro"}')).toThrow(
      'non è un file di composizioni',
    )
    expect(() => composizioniFromFile('non json')).toThrow('JSON non valido')
    expect(text).toContain(FILE_FORMAT)
  })
})
