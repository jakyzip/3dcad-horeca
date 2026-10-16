import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import {
  addBox,
  GAP,
  GASKET,
  PANEL_WHITE,
  PLINTH,
  STAINLESS,
  STAINLESS_DARK,
} from './geometry-base'
import { bowlsOf, buildLavelloAGiorno, gocciolatoio, pianoForato } from './geometry-smontabili'
import type { BancoFrigoNode, CellaFrigoNode, GenericoNode, LavelloNode } from './schema'

export {
  addBox,
  type Box,
  GASKET,
  PANEL_WHITE,
  PLINTH,
  STAINLESS,
  STAINLESS_DARK,
} from './geometry-base'

/**
 * Refrigerated counter: steel cabinet on a recessed plinth, a worktop overhanging the front, and
 * one door per ~0.6 m of length with a handle bar.
 */
export function buildBancoFrigoGeometry(node: BancoFrigoNode): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const steel = new MeshStandardMaterial(STAINLESS)
  const dark = new MeshStandardMaterial(STAINLESS_DARK)
  const gasket = new MeshStandardMaterial(GASKET)
  const top = Math.min(0.04, H * 0.1)
  const body = H - top - PLINTH

  addBox(group, { w: W - 0.04, h: PLINTH, d: D - 0.08, y: PLINTH / 2 }, gasket, 'banco-plinth')
  addBox(group, { w: W, h: body, d: D - 0.02, y: PLINTH + body / 2, z: -0.01 }, steel, 'banco-body')
  addBox(group, { w: W + 0.02, h: top, d: D + 0.02, y: H - top / 2 }, steel, 'banco-top')

  const doors = Math.max(1, Math.round(W / 0.6))
  const doorW = W / doors
  for (let i = 0; i < doors; i++) {
    const x = -W / 2 + doorW * (i + 0.5)
    addBox(
      group,
      { w: doorW - GAP * 4, h: body - 0.03, d: 0.01, x, y: PLINTH + body / 2, z: D / 2 - 0.015 },
      steel,
      'banco-door',
    )
    addBox(
      group,
      { w: doorW * 0.5, h: 0.015, d: 0.02, x, y: PLINTH + body - 0.06, z: D / 2 },
      dark,
      'banco-handle',
    )
  }
  return group
}

/** Modular cold room: insulated white panels with a darker door on the front face. */
export function buildCellaFrigoGeometry(node: CellaFrigoNode): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const panel = new MeshStandardMaterial(PANEL_WHITE)
  const dark = new MeshStandardMaterial(STAINLESS_DARK)
  const gasket = new MeshStandardMaterial(GASKET)

  addBox(group, { w: W, h: H, d: D, y: H / 2 }, panel, 'cella-body')
  // Panel joints every ~1.2 m on the front, as the modular panels read.
  const joints = Math.max(0, Math.round(W / 1.2) - 1)
  for (let i = 1; i <= joints; i++) {
    addBox(
      group,
      { w: 0.01, h: H - 0.02, d: 0.005, x: -W / 2 + (W * i) / (joints + 1), y: H / 2, z: D / 2 },
      gasket,
      'cella-joint',
    )
  }
  const doorW = Math.min(0.9, W * 0.6)
  const doorH = Math.min(1.9, H - 0.15)
  addBox(
    group,
    {
      w: doorW,
      h: doorH,
      d: 0.03,
      x: W / 2 - doorW / 2 - 0.1,
      y: doorH / 2 + 0.02,
      z: D / 2 + 0.015,
    },
    dark,
    'cella-door',
  )
  addBox(
    group,
    { w: 0.04, h: 0.25, d: 0.04, x: W / 2 - doorW - 0.05, y: 1.05, z: D / 2 + 0.05 },
    gasket,
    'cella-handle',
  )
  return group
}

/**
 * Stainless sink: on a closed cabinet with a tap behind the bowls, or open on legs (see
 * `geometry-smontabili.ts`); one or two bowls, or a bowl and a drainer.
 */
export function buildLavelloGeometry(node: LavelloNode): Group {
  if (node.struttura === 'a giorno') return buildLavelloAGiorno(node)
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const steel = new MeshStandardMaterial(STAINLESS)
  const dark = new MeshStandardMaterial(STAINLESS_DARK)
  const gasket = new MeshStandardMaterial(GASKET)
  const top = 0.04

  addBox(group, { w: W - 0.04, h: PLINTH, d: D - 0.08, y: PLINTH / 2 }, gasket, 'lavello-plinth')
  addBox(
    group,
    { w: W, h: H - top - PLINTH, d: D - 0.02, y: PLINTH + (H - top - PLINTH) / 2, z: -0.01 },
    steel,
    'lavello-body',
  )
  const { bowls, drainer } = bowlsOf(node)
  pianoForato(group, W, D, H - top / 2, bowls, steel, 'lavello-top')
  // The cabinet fills the volume under the worktop: the bowls read as dark wells in the top.
  for (const b of bowls)
    addBox(
      group,
      { w: b.w, h: 0.004, d: b.d, x: b.x, y: H - top + 0.002, z: b.z },
      dark,
      'lavello-basin-floor',
    )
  if (drainer) gocciolatoio(group, drainer, H, dark)
  if (node.alzatina)
    addBox(
      group,
      { w: W, h: 0.1, d: 0.012, y: H + 0.05, z: -D / 2 + 0.006 },
      steel,
      'lavello-alzatina',
    )

  const tapZ = -D / 2 + Math.max(0.05, (D - (bowls[0]?.d ?? 0.4)) / 4)
  for (const b of bowls) {
    const tap = new Mesh(new CylinderGeometry(0.012, 0.012, 0.3, 16), dark)
    tap.position.set(b.x, H + 0.15, tapZ)
    tap.name = 'lavello-tap'
    group.add(tap)
    const spout = new Mesh(new BoxGeometry(0.02, 0.02, 0.18), dark)
    spout.position.set(b.x, H + 0.29, tapZ + 0.08)
    spout.name = 'lavello-spout'
    group.add(spout)
  }
  return group
}

/** Generic article: a plain steel block on a plinth, sized like the article. */
export function buildGenericoGeometry(node: GenericoNode): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const steel = new MeshStandardMaterial(STAINLESS)
  const gasket = new MeshStandardMaterial(GASKET)
  const plinth = Math.min(PLINTH, H * 0.2)
  addBox(group, { w: W * 0.97, h: plinth, d: D * 0.9, y: plinth / 2 }, gasket, 'generico-plinth')
  addBox(group, { w: W, h: H - plinth, d: D, y: plinth + (H - plinth) / 2 }, steel, 'generico-body')
  return group
}
