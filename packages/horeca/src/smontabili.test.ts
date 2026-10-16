import { describe, expect, test } from 'bun:test'
import type { Group, Mesh } from 'three'
import { placementFor } from './catalog-store'
import { buildLavelloGeometry } from './geometry'
import { buildTavoloGeometry } from './geometry-smontabili'
import { LAVELLO, LavelloNode, TAVOLO } from './schema'
import { daCodice, pianoLavello } from './smontabili'

const names = (group: Group) => group.children.map((c) => (c as Mesh).name)
const count = (group: Group, name: string) => names(group).filter((n) => n === name).length

describe('daCodice', () => {
  test('reads a table code: size in decimetres, the model letters as options', () => {
    expect(daCodice('ETGE 12/7 AR')).toEqual({
      kind: TAVOLO,
      defaults: { width: 1.2, depth: 0.7, height: 0.9, alzatina: true, ripiano: true },
    })
    expect(daCodice('etge 7/6')?.defaults).toMatchObject({ alzatina: false, ripiano: false })
    expect(daCodice('ETGE 18/6 A')?.defaults).toMatchObject({ alzatina: true, ripiano: false })
    expect(daCodice('ETGE 9/7 R')?.defaults).toMatchObject({ alzatina: false, ripiano: true })
  })

  test('reads a sink code with the bowl the price list gives for it', () => {
    expect(daCodice('ELGE 6/7')?.defaults).toMatchObject({
      vasche: '1 vasca',
      vascaLarghezza: 0.4,
      vascaProfondita: 0.5,
      vascaAltezza: 0.25,
    })
    expect(daCodice('ELGE 8/7')?.defaults).toMatchObject({
      vascaLarghezza: 0.6,
      vascaAltezza: 0.32,
    })
    expect(daCodice('ELGE 2V 10/6')?.defaults).toMatchObject({
      vasche: '2 vasche',
      vascaLarghezza: 0.4,
      vascaProfondita: 0.4,
    })
    expect(daCodice('ELGE 2V 13/7')?.defaults).toMatchObject({
      vascaLarghezza: 0.5,
      vascaAltezza: 0.3,
    })
    expect(daCodice('ELGE 1VGDX 14/7')).toEqual({
      kind: LAVELLO,
      defaults: {
        width: 1.4,
        depth: 0.7,
        height: 0.9,
        struttura: 'a giorno',
        vasche: 'vasca + gocciolatoio',
        alzatina: true,
        vascaLarghezza: 0.6,
        vascaProfondita: 0.5,
        vascaAltezza: 0.32,
      },
    })
  })

  test('leaves any other code alone', () => {
    expect(daCodice('BF-150')).toBeNull()
    expect(daCodice('ETGE 12/8')).toBeNull()
    expect(daCodice('ELGE 1VGSX 12/7')).toBeNull()
  })

  test('sets the shape when the article is placed from the catalog; the CRM sizes win', () => {
    const placement = placementFor(
      {
        item_id: '',
        code: 'ETGE 14/7 A',
        name: 'Tavolo',
        category: 'Arredo',
        width_mm: 1400,
        depth_mm: 700,
        height_mm: 850,
        source: 'file',
      },
      {},
    )
    expect(placement.kind).toBe(TAVOLO)
    expect(placement.defaults).toMatchObject({ height: 0.85, alzatina: true, ripiano: false })
  })
})

describe('pianoLavello', () => {
  test('two bowls, one in each half', () => {
    const { bowls, drainer } = pianoLavello(1.2, 0.6, '2 vasche', { w: 0.5, d: 0.4 })
    expect(bowls.map((b) => b.x)).toEqual([-0.3, 0.3])
    expect(bowls.every((b) => b.w === 0.5 && b.d === 0.4)).toBe(true)
    expect(drainer).toBeNull()
  })

  test('the bowl on the left, the drainer filling the right', () => {
    const { bowls, drainer } = pianoLavello(1, 0.7, 'vasca + gocciolatoio', { w: 0.5, d: 0.5 })
    expect(bowls).toHaveLength(1)
    expect(bowls[0]!.w).toBe(0.5)
    expect(bowls[0]!.x).toBeLessThan(0)
    expect(drainer!.x - drainer!.w / 2).toBeGreaterThan(bowls[0]!.x + bowls[0]!.w / 2)
    expect(drainer!.x + drainer!.w / 2).toBeCloseTo(0.45)
  })

  test('shrinks a bowl that does not fit the worktop', () => {
    const { bowls } = pianoLavello(0.5, 0.45, '1 vasca', { w: 0.6, d: 0.5 })
    expect(bowls[0]!.w).toBeCloseTo(0.4)
    expect(bowls[0]!.d).toBeCloseTo(0.35)
  })
})

describe('geometry of the open line', () => {
  const size = { width: 1.2, depth: 0.7, height: 0.9 }

  test('a table without shelf has rails low down, with shelf none', () => {
    const plain = buildTavoloGeometry({ ...size, ripiano: false })
    expect(count(plain, 'giorno-leg')).toBe(4)
    expect(count(plain, 'giorno-foot')).toBe(4)
    expect(count(plain, 'giorno-rail')).toBe(3)
    expect(count(plain, 'giorno-shelf')).toBe(0)
    const shelf = buildTavoloGeometry({ ...size, ripiano: true })
    expect(count(shelf, 'giorno-rail')).toBe(0)
    expect(count(shelf, 'giorno-shelf')).toBe(1)
  })

  test('behind an upstand the back legs stand 50 mm further in', () => {
    const backLeg = (group: Group) =>
      Math.min(...group.children.filter((c) => c.name === 'giorno-leg').map((c) => c.position.z))
    const plain = buildTavoloGeometry({ ...size, alzatina: false })
    const upstand = buildTavoloGeometry({ ...size, alzatina: true })
    expect(count(upstand, 'giorno-alzatina')).toBe(1)
    expect(backLeg(upstand) - backLeg(plain)).toBeCloseTo(0.05)
  })

  test('a sink on legs has its bowls and drainer; an old cabinet sink still builds', () => {
    const open = buildLavelloGeometry(
      LavelloNode.parse({
        ...size,
        struttura: 'a giorno',
        vasche: 'vasca + gocciolatoio',
        vascaLarghezza: 0.5,
        vascaProfondita: 0.5,
      }),
    )
    expect(count(open, 'vasca-fondo')).toBe(1)
    expect(count(open, 'gocciolatoio')).toBeGreaterThan(10)
    expect(count(open, 'giorno-leg')).toBe(4)
    // A scene saved before these fields: the defaults give the cabinet sink with one bowl.
    const old = buildLavelloGeometry(LavelloNode.parse({ type: LAVELLO, ...size }))
    expect(count(old, 'lavello-body')).toBe(1)
    expect(count(old, 'lavello-basin-floor')).toBe(1)
    expect(count(old, 'lavello-tap')).toBe(1)
  })
})
