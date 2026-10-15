import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import type { BancoFrigoNode, CellaFrigoNode, LavelloNode } from './schema'

// Medium-quality looks (see CLAUDE.md): flat PBR colours, no textures.
const STAINLESS = { color: '#c9ccd1', metalness: 0.75, roughness: 0.35 }
const STAINLESS_DARK = { color: '#8d939b', metalness: 0.7, roughness: 0.45 }
const PANEL_WHITE = { color: '#eef0f2', metalness: 0.1, roughness: 0.6 }
const GASKET = { color: '#2b2d31', metalness: 0, roughness: 0.8 }

const PLINTH = 0.1
const GAP = 0.004

type Box = { w: number; h: number; d: number; x?: number; y: number; z?: number }

function addBox(group: Group, box: Box, material: Material, name: string) {
  const mesh = new Mesh(new BoxGeometry(box.w, box.h, box.d), material)
  mesh.position.set(box.x ?? 0, box.y, box.z ?? 0)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

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

/** Stainless sink unit: cabinet, worktop with a sunken basin, and a tap behind it. */
export function buildLavelloGeometry(node: LavelloNode): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const steel = new MeshStandardMaterial(STAINLESS)
  const dark = new MeshStandardMaterial(STAINLESS_DARK)
  const gasket = new MeshStandardMaterial(GASKET)
  const top = 0.04
  const body = H - top - PLINTH

  addBox(group, { w: W - 0.04, h: PLINTH, d: D - 0.08, y: PLINTH / 2 }, gasket, 'lavello-plinth')
  addBox(
    group,
    { w: W, h: body, d: D - 0.02, y: PLINTH + body / 2, z: -0.01 },
    steel,
    'lavello-body',
  )

  // Worktop as four strips around the basin opening, so the basin reads as sunken.
  const basinW = Math.min(0.5, W * 0.6)
  const basinD = Math.min(0.4, D * 0.6)
  const y = H - top / 2
  const sideW = (W - basinW) / 2
  const frontD = (D - basinD) / 2
  addBox(group, { w: sideW, h: top, d: D, x: -W / 2 + sideW / 2, y }, steel, 'lavello-top')
  addBox(group, { w: sideW, h: top, d: D, x: W / 2 - sideW / 2, y }, steel, 'lavello-top')
  addBox(group, { w: basinW, h: top, d: frontD, y, z: D / 2 - frontD / 2 }, steel, 'lavello-top')
  addBox(group, { w: basinW, h: top, d: frontD, y, z: -D / 2 + frontD / 2 }, steel, 'lavello-top')
  const basinDepth = Math.min(0.25, body * 0.5)
  addBox(
    group,
    { w: basinW, h: 0.01, d: basinD, y: H - top - basinDepth },
    dark,
    'lavello-basin-floor',
  )

  const tap = new Mesh(new CylinderGeometry(0.012, 0.012, 0.3, 16), dark)
  tap.position.set(0, H + 0.15, -D / 2 + frontD / 2)
  tap.name = 'lavello-tap'
  group.add(tap)
  const spout = new Mesh(new BoxGeometry(0.02, 0.02, 0.18), dark)
  spout.position.set(0, H + 0.29, -D / 2 + frontD / 2 + 0.08)
  spout.name = 'lavello-spout'
  group.add(spout)
  return group
}
