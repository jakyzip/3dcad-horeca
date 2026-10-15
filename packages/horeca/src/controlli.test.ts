import { describe, expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import {
  controllaLivello,
  controlliFloorplan,
  descriviProblema,
  hostOf,
  overlapDepth,
  readSoglie,
  SOGLIE_PREDEFINITE,
  withSoglie,
} from './controlli'
import type { EquipmentNode } from './schema'

/** A unit facing +z (rotation 0) or −z (rotation π), centred at (x, z). */
const unit = (
  id: string,
  x: number,
  z: number,
  extra: Partial<EquipmentNode> = {},
): EquipmentNode =>
  ({
    id,
    type: 'horeca:banco-frigo',
    position: [x, 0, z],
    rotation: 0,
    width: 1,
    depth: 0.6,
    height: 0.9,
    elevation: 0,
    metadata: {},
    ...extra,
  }) as unknown as EquipmentNode

const wall = (start: [number, number], end: [number, number]) =>
  ({ type: 'wall', start, end, thickness: 0.2 }) as unknown as AnyNode

describe('thresholds', () => {
  test('defaults 90 / 120, stored on the project host', () => {
    expect(readSoglie(undefined)).toEqual(SOGLIE_PREDEFINITE)
    const metadata = withSoglie({ crm: { x: 1 } }, { passaggio: 1, lavoro: 1.5 })
    expect(readSoglie(metadata)).toEqual({ passaggio: 1, lavoro: 1.5 })
    expect(metadata.crm).toEqual({ x: 1 })
  })

  test('the host is the site above the level, else the building', () => {
    const nodes: Record<string, AnyNode> = {
      site: { id: 'site', type: 'site', parentId: null } as unknown as AnyNode,
      b: { id: 'b', type: 'building', parentId: 'site' } as unknown as AnyNode,
      l: { id: 'l', type: 'level', parentId: 'b' } as unknown as AnyNode,
    }
    expect(hostOf({ parentId: 'l' }, (id) => nodes[id])?.id).toBe('site' as never)
    delete nodes.site
    expect(hostOf({ parentId: 'l' }, (id) => nodes[id])?.id).toBe('b' as never)
  })
})

describe('overlaps', () => {
  test('separating axes: depth when they overlap, 0 when just touching', () => {
    const a: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    const b = a.map(([x, y]) => [x + 0.8, y] as [number, number])
    const c = a.map(([x, y]) => [x + 1, y] as [number, number])
    expect(overlapDepth(a, b)).toBeCloseTo(0.2)
    expect(overlapDepth(a, c)).toBe(0)
  })

  test('two units on top of each other, one into a wall; a wall cabinet over a table is fine', () => {
    const problems = controllaLivello(
      [
        unit('a', 2, 2),
        unit('b', 2.7, 2),
        unit('c', 5, 0.35),
        unit('d', 2, 2, { elevation: 1.5, height: 0.6, type: 'horeca:pensile' } as never),
      ],
      [wall([0, 0], [8, 0])],
      SOGLIE_PREDEFINITE,
    )
    const kinds = problems.filter((p) => p.tipo !== 'passaggio').map((p) => [p.tipo, p.id])
    expect(kinds).toEqual([
      ['sovrapposizione', 'a'],
      ['muro', 'c'],
    ])
  })
})

describe('aisles', () => {
  test('a unit facing a wall needs the passage width; facing another unit, the working width', () => {
    // Front of `a` at z = 1.3; wall face at z = 2.1: 80 cm, under 90.
    const vsWall = controllaLivello(
      [unit('a', 2, 1)],
      [wall([0, 2.2], [8, 2.2])],
      SOGLIE_PREDEFINITE,
    )
    const aisle = vsWall.find((p) => p.tipo === 'passaggio')
    expect(aisle && aisle.tipo === 'passaggio' && aisle.larghezza).toBeCloseTo(0.8)
    expect(aisle && aisle.tipo === 'passaggio' && aisle.minimo).toBe(0.9)

    // Two counters facing each other 1 m apart: a working aisle under 1,20.
    const facing = controllaLivello(
      [unit('a', 2, 1), unit('b', 2, 2.6, { rotation: Math.PI })],
      [],
      SOGLIE_PREDEFINITE,
    )
    const work = facing.filter((p) => p.tipo === 'passaggio')
    expect(work).toHaveLength(2)
    expect(
      work.every((p) => p.tipo === 'passaggio' && p.lavoro && Math.abs(p.larghezza - 1) < 1e-6),
    ).toBe(true)
  })

  test('wide enough or blocked only by a wall cabinet: no warning', () => {
    expect(
      controllaLivello([unit('a', 2, 1)], [wall([0, 3], [8, 3])], SOGLIE_PREDEFINITE).filter(
        (p) => p.tipo === 'passaggio',
      ),
    ).toEqual([])
    expect(
      controllaLivello(
        [unit('a', 2, 1), unit('p', 2, 1.8, { elevation: 1.5, rotation: Math.PI })],
        [],
        SOGLIE_PREDEFINITE,
      ),
    ).toEqual([])
  })

  test('words and plan marks', () => {
    const [p] = controllaLivello([unit('a', 2, 1)], [wall([0, 2.2], [8, 2.2])], SOGLIE_PREDEFINITE)
    expect(descriviProblema(p!, () => '')).toBe(
      'Passaggio di 80 cm davanti, verso il muro: ne servono 90 cm.',
    )
    const plan = controlliFloorplan(unit('a', 2, 1), [p!])
    const texts = plan?.kind === 'group' ? plan.children.filter((c) => c.kind === 'text') : []
    expect(texts.map((t) => (t.kind === 'text' ? t.text : ''))).toEqual(['80 cm < 90 cm'])
  })
})
