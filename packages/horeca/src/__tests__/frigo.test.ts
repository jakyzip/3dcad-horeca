import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { loadPlugin, nodeRegistry } from '@pascal-app/core'
import type { Object3D } from 'three'
import { shapeForArticle } from '../catalog-store'
import { buildDistinta, type DistintaNode, pollici } from '../distinta'
import { horecaPlugin } from '../index'
import {
  BANCO_FRIGO,
  CELLA_FRIGO,
  CENTRALE_FRIGO,
  EVAPORATORE,
  MOTOCONDENSANTE,
  QUADRO_FRIGO,
} from '../schema'

let restore: () => void
beforeEach(async () => {
  restore = nodeRegistry._snapshot()
  nodeRegistry._reset()
  await loadPlugin(horecaPlugin)
})
afterEach(() => restore())

const node = (kind: string, patch: Record<string, unknown> = {}) => {
  const def = nodeRegistry.get(kind)!
  return def.schema.parse({ ...def.defaults(), ...patch }) as never
}
const names = (kind: string) => {
  const out: string[] = []
  nodeRegistry.get(kind)!.geometry!(node(kind), {} as never).traverse((o: Object3D) => {
    out.push(o.name)
  })
  return out
}

describe('refrigeration plant', () => {
  test('each unit builds its recognisable parts', () => {
    expect(names(MOTOCONDENSANTE)).toEqual(
      expect.arrayContaining(['ventola', 'batteria', 'moto-rubinetto']),
    )
    expect(names(EVAPORATORE)).toEqual(
      expect.arrayContaining(['ventola', 'batteria', 'evap-bacinella']),
    )
    expect(names(CENTRALE_FRIGO)).toEqual(
      expect.arrayContaining(['centrale-compressore', 'centrale-collettore', 'centrale-quadro']),
    )
    expect(names(QUADRO_FRIGO)).toEqual(expect.arrayContaining(['quadro-display']))
  })

  test('a condensing unit offers its refrigerant port on the right side, turned with it', () => {
    const def = nodeRegistry.get(MOTOCONDENSANTE)!
    const [port] = def.ports!(node(MOTOCONDENSANTE, { position: [5, 0, 2], rotation: 0 }))
    expect(port!.system).toBe('refrigerant')
    expect(port!.position[0]).toBeCloseTo(5 + 1.1 / 2 + 0.06)
    expect(port!.direction).toEqual([1, 0, 0])
    // A quarter turn left: its right side now faces -z.
    const [turned] = def.ports!(
      node(MOTOCONDENSANTE, { position: [0, 0, 0], rotation: Math.PI / 2 }),
    )
    expect(turned!.direction[2]).toBeCloseTo(-1)
    expect(turned!.position[2]).toBeCloseTo(-(1.1 / 2 + 0.06))
  })

  test('a unit cooler hangs under the ceiling and its port goes up with it', () => {
    const def = nodeRegistry.get(EVAPORATORE)!
    const hung = node(EVAPORATORE) as unknown as { elevation: number }
    expect(hung.elevation).toBe(2)
    const [port] = def.ports!(hung as never)
    expect(port!.position[1]).toBeCloseTo(2 + 0.4 * 0.55)
  })

  test('a cold room takes its line through the roof, a remote counter from the back', () => {
    const [cella] = nodeRegistry.get(CELLA_FRIGO)!.ports!(node(CELLA_FRIGO))
    expect(cella!.position[1]).toBeCloseTo(2.2)
    expect(cella!.direction).toEqual([0, 1, 0])
    const [banco] = nodeRegistry.get(BANCO_FRIGO)!.ports!(node(BANCO_FRIGO))
    expect(banco!.position[2]).toBeLessThan(-0.35)
    expect(banco!.direction[2]).toBeCloseTo(-1)
  })

  test('a rack offers one line per compressor, from the top', () => {
    const def = nodeRegistry.get(CENTRALE_FRIGO)!
    const ports = def.ports!(node(CENTRALE_FRIGO, { width: 2.6 }))
    expect(ports.length).toBeGreaterThanOrEqual(3)
    expect(ports.every((p) => p.direction[1] === 1)).toBe(true)
    expect(new Set(ports.map((p) => p.id)).size).toBe(ports.length)
  })

  test('catalog names land on the plant kinds, not on the fridge', () => {
    const shape = (name: string, category = 'Refrigerazione') =>
      shapeForArticle({}, { name, category })
    expect(shape('Unità motocondensante 3 HP')).toBe(MOTOCONDENSANTE)
    expect(shape('Evaporatore ventilato 2 ventole')).toBe(EVAPORATORE)
    expect(shape('Centrale frigo 3 compressori')).toBe(CENTRALE_FRIGO)
    expect(shape('Quadro elettrico frigo cella')).toBe(QUADRO_FRIGO)
  })
})

describe('refrigerant runs in the distinta', () => {
  const run = (id: string, path: number[][], extra: Record<string, unknown> = {}) =>
    ({
      id,
      type: 'lineset',
      path,
      suctionDiameter: 0.875,
      liquidDiameter: 0.375,
      ...extra,
    }) as DistintaNode

  test('pipe sizes read as fitters say them', () => {
    expect(pollici(0.875)).toBe('7/8"')
    expect(pollici(0.375)).toBe('3/8"')
    expect(pollici(1.125)).toBe('1 1/8"')
    expect(pollici(1)).toBe('1"')
  })

  test('runs of the same sizes add up, in whole metres rounded up', () => {
    const { local, rows } = buildDistinta({
      a: run('a', [
        [0, 0, 0],
        [3, 0, 0],
        [3, 2.5, 0],
      ]),
      b: run('b', [
        [0, 0, 0],
        [0, 0, 1.2],
      ]),
      c: run(
        'c',
        [
          [0, 0, 0],
          [2, 0, 0],
        ],
        { suctionDiameter: 1.125 },
      ),
    })
    expect(rows).toEqual([])
    expect(local).toEqual([
      {
        item_id: '',
        code: 'LINEA-FRIGO 1 1/8" + 3/8"',
        name: 'Linea frigorifera 1 1/8" + 3/8" (m)',
        quantity: 2,
      },
      {
        item_id: '',
        code: 'LINEA-FRIGO 7/8" + 3/8"',
        name: 'Linea frigorifera 7/8" + 3/8" (m)',
        quantity: 7,
      },
    ])
  })

  test('a run linked to a CRM article goes to the CRM, in metres', () => {
    const product = {
      item_id: 'c0000000-0000-4000-8000-000000000003',
      code: 'TUB-78',
      name: 'Tubo 7/8',
    }
    const { rows } = buildDistinta({
      a: run(
        'a',
        [
          [0, 0, 0],
          [4.2, 0, 0],
        ],
        { metadata: { product } },
      ),
    })
    expect(rows).toEqual([{ ...product, quantity: 5 }])
  })
})
