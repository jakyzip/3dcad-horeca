import { describe, expect, test } from 'bun:test'
import { findWalls, type Segment } from './rilievo-walls'

/** The outline of a rectangle as four segments. */
const rect = (x0: number, y0: number, x1: number, y1: number): Segment[] => [
  [
    [x0, y0],
    [x1, y0],
  ],
  [
    [x1, y0],
    [x1, y1],
  ],
  [
    [x1, y1],
    [x0, y1],
  ],
  [
    [x0, y1],
    [x0, y0],
  ],
]

const round = (p: readonly number[]) => p.map((v) => Math.round(v * 1000) / 1000)

describe('findWalls', () => {
  test('a 6 × 4 m room with 30 cm walls gives four walls meeting on their axes', () => {
    const walls = findWalls([...rect(-0.3, -0.3, 6.3, 4.3), ...rect(0, 0, 6, 4)])
    expect(walls).toHaveLength(4)
    for (const w of walls) expect(w.thickness).toBeCloseTo(0.3)
    const ends = walls.flatMap((w) => [round(w.start), round(w.end)].map((p) => p.join(',')))
    // Every corner is shared by two walls, on the axis (15 cm out from the inner face).
    for (const corner of ['-0.15,-0.15', '6.15,-0.15', '6.15,4.15', '-0.15,4.15'])
      expect(ends.filter((e) => e === corner)).toHaveLength(2)
  })

  test('a door leaves a gap between two walls', () => {
    const innerLeft: Segment = [
      [0, 0.2],
      [1, 0.2],
    ]
    const innerRight: Segment = [
      [1.9, 0.2],
      [6, 0.2],
    ]
    const outerLeft: Segment = [
      [0, 0],
      [1, 0],
    ]
    const outerRight: Segment = [
      [1.9, 0],
      [6, 0],
    ]
    const walls = findWalls([outerLeft, outerRight, innerLeft, innerRight])
    expect(walls).toHaveLength(2)
    expect(walls.map((w) => w.thickness)).toEqual([0.2, 0.2])
  })

  test('a corridor between two thin walls stays two walls', () => {
    const walls = findWalls([
      [
        [0, 0],
        [5, 0],
      ],
      [
        [0, 0.1],
        [5, 0.1],
      ],
      [
        [0, 0.5],
        [5, 0.5],
      ],
      [
        [0, 0.6],
        [5, 0.6],
      ],
    ])
    expect(walls.map((w) => w.thickness)).toEqual([0.1, 0.1])
  })

  test('lines too far apart or too short are not walls', () => {
    expect(
      findWalls([
        [
          [0, 0],
          [5, 0],
        ],
        [
          [0, 1],
          [5, 1],
        ],
      ]),
    ).toHaveLength(0)
    expect(
      findWalls([
        [
          [0, 0],
          [0.1, 0],
        ],
        [
          [0, 0.2],
          [0.1, 0.2],
        ],
      ]),
    ).toHaveLength(0)
  })
})
