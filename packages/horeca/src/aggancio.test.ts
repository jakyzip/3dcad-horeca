import { describe, expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { aggancia, dentroUnMuro, intorno, type Sagoma, type Vicino } from './aggancio'

const wall = (start: [number, number], end: [number, number]) =>
  ({ type: 'wall', start, end, thickness: 0.2 }) as unknown as AnyNode

/** A wall along x through z = 0: its room-side face is at z = 0.1, facing +z. */
const north = wall([-5, 0], [5, 0])
/** A wall along z through x = -2: its room-side face is at x = -1.9, facing +x. */
const west = wall([-2, -5], [-2, 5])

const banco: Sagoma = { width: 1, depth: 0.6, height: 0.9, elevation: 0 }
const near = (centre: [number, number], extra: Partial<Vicino> = {}): Vicino => ({
  centre,
  rotation: 0,
  ...banco,
  ...extra,
})

const round = (p: { centre: [number, number]; rotation: number } | null) =>
  p && {
    centre: p.centre.map((v) => Math.round(v * 1000) / 1000 + 0),
    rotation: Math.round(p.rotation * 1000) / 1000 + 0,
  }

describe('aggancia: walls', () => {
  test('a unit near a wall sits flush with its back to it', () => {
    expect(round(aggancia({ centre: [0, 0.5], rotation: 0 }, banco, [north], []))).toEqual({
      centre: [0, 0.4],
      rotation: 0,
    })
  })

  test('a unit dropped into the wall is pushed back out on the room side', () => {
    expect(round(aggancia({ centre: [0, 0.2], rotation: 0 }, banco, [north], []))).toEqual({
      centre: [0, 0.4],
      rotation: 0,
    })
  })

  test('the unit turns its back to the wall, whatever its heading', () => {
    expect(round(aggancia({ centre: [0, 0.5], rotation: 0.3 }, banco, [north], []))?.rotation).toBe(
      0,
    )
    expect(
      round(aggancia({ centre: [0, 0.5], rotation: Math.PI }, banco, [north], []))?.rotation,
    ).toBeCloseTo(2 * Math.PI, 3)
    // Beside a wall running along z (room side facing +x): back to it means facing +x.
    expect(round(aggancia({ centre: [-1.5, 3], rotation: 0 }, banco, [west], []))).toEqual({
      centre: [-1.6, 3],
      rotation: 1.571,
    })
  })

  test('near a second wall it slides into the corner', () => {
    expect(
      round(aggancia({ centre: [-1.3, 0.45], rotation: 0 }, banco, [north, west], [])),
    ).toEqual({ centre: [-1.4, 0.4], rotation: 0 })
  })

  test('far from walls and units nothing happens', () => {
    expect(aggancia({ centre: [0, 1.5], rotation: 0 }, banco, [north], [])).toBeNull()
  })
})

describe('aggancia: units alongside', () => {
  test('along a wall it closes the gap to the unit beside it', () => {
    expect(
      round(aggancia({ centre: [0.1, 0.45], rotation: 0 }, banco, [north], [near([1.2, 0.4])])),
    ).toEqual({ centre: [0.2, 0.4], rotation: 0 })
  })

  test('in the middle of the room it goes side by side and lines up', () => {
    expect(
      round(aggancia({ centre: [6.05, 5.05], rotation: 0 }, banco, [north], [near([5, 5])])),
    ).toEqual({ centre: [6, 5], rotation: 0 })
  })

  test('an overlap is pushed apart', () => {
    expect(round(aggancia({ centre: [5.9, 5], rotation: 0 }, banco, [], [near([5, 5])]))).toEqual({
      centre: [6, 5],
      rotation: 0,
    })
  })

  test('a wall cupboard above a counter ignores it', () => {
    const pensile = { ...banco, elevation: 1.5, depth: 0.35 }
    expect(
      round(aggancia({ centre: [0.1, 0.3], rotation: 0 }, pensile, [north], [near([1.2, 0.4])])),
    ).toEqual({ centre: [0.1, 0.275], rotation: 0 })
  })
})

describe('dentroUnMuro', () => {
  test('tells a unit through the wall from one against it', () => {
    expect(dentroUnMuro({ centre: [0, 0.2], rotation: 0 }, banco, [north])).toBe(true)
    expect(dentroUnMuro({ centre: [0, 0.4], rotation: 0 }, banco, [north])).toBe(false)
  })
})

describe('intorno', () => {
  test('reads the level walls and the other units, not the moving one', () => {
    const nodes = {
      level: { id: 'level', type: 'level', children: ['w', 'a', 'b', 'r'] },
      w: { ...north, id: 'w' },
      a: { id: 'a', type: 'horeca:banco-frigo', position: [1, 0, 2], rotation: 0, ...banco },
      b: { id: 'b', type: 'horeca:lavello', position: [3, 0, 2], rotation: 0, ...banco },
      r: { id: 'r', type: 'horeca:rilievo', width: 1 },
    } as unknown as Record<string, AnyNode>
    const { walls, others } = intorno(nodes, 'level', ['a'])
    expect(walls).toHaveLength(1)
    expect(others.map((o) => o.centre)).toEqual([[3, 2]])
  })
})
