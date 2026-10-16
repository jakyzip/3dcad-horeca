import { CylinderGeometry, Group, type Material, Mesh, MeshStandardMaterial } from 'three'
import { addBox, GASKET, PANEL_WHITE, PLINTH, STAINLESS, STAINLESS_DARK } from './geometry'
import type { EquipmentNode } from './schema'

/**
 * Lab equipment seen in the reference render (a gelato lab): stainless tables, wall cabinets, hand
 * basin, dishwasher, blast chiller, batch freezer, pasteuriser, upright fridge, mobile bins.
 * Every builder works in the unit's local frame: x across the front, z towards the user (front
 * face at +depth/2), y up from the unit's underside. Elevation is applied by the definition.
 */

const BLACK_GLASS = { color: '#1d2430', metalness: 0.3, roughness: 0.25 }
const DISPLAY_BLUE = { color: '#2563eb', metalness: 0.2, roughness: 0.4 }

function cylinder(
  group: Group,
  radius: number,
  height: number,
  material: Material,
  name: string,
  at: { x?: number; y: number; z?: number },
  axis: 'y' | 'x' | 'z' = 'y',
) {
  const mesh = new Mesh(new CylinderGeometry(radius, radius, height, 20), material)
  if (axis === 'x') mesh.rotation.z = Math.PI / 2
  if (axis === 'z') mesh.rotation.x = Math.PI / 2
  mesh.position.set(at.x ?? 0, at.y, at.z ?? 0)
  mesh.name = name
  mesh.castShadow = true
  group.add(mesh)
  return mesh
}

/** Four swivel castors under a W × D footprint; returns their height. */
function castors(group: Group, W: number, D: number, material: Material, name: string) {
  const r = Math.min(0.05, W / 8, D / 8)
  const inset = r * 1.4
  for (const x of [-W / 2 + inset, W / 2 - inset]) {
    for (const z of [-D / 2 + inset, D / 2 - inset]) {
      cylinder(group, r, r * 0.8, material, name, { x, y: r, z }, 'x')
    }
  }
  return r * 2
}

/**
 * Wall cabinet with two sliding doors. As a "gocciolatoio" it has no bottom panel, a drying rack
 * instead, so it drips into the sink below.
 */
export function buildPensileGeometry(node: EquipmentNode): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const steel = new MeshStandardMaterial(STAINLESS)
  const dark = new MeshStandardMaterial(STAINLESS_DARK)
  const t = 0.015
  addBox(group, { w: W, h: t, d: D, y: H - t / 2 }, steel, 'pensile-body')
  addBox(group, { w: W, h: H, d: t, y: H / 2, z: -D / 2 + t / 2 }, steel, 'pensile-back')
  addBox(group, { w: t, h: H, d: D, x: -W / 2 + t / 2, y: H / 2 }, steel, 'pensile-side')
  addBox(group, { w: t, h: H, d: D, x: W / 2 - t / 2, y: H / 2 }, steel, 'pensile-side')
  if (node.gocciolatoio) {
    const bars = Math.max(4, Math.round(W / 0.04))
    for (let i = 0; i < bars; i++) {
      const x = -W / 2 + (W * (i + 0.5)) / bars
      addBox(group, { w: 0.006, h: 0.006, d: D - 2 * t, x, y: 0.05 }, dark, 'pensile-rack')
    }
  } else {
    addBox(group, { w: W, h: t, d: D, y: t / 2 }, steel, 'pensile-bottom')
  }
  // Two sliding doors on parallel tracks, overlapping at the middle.
  const doorW = W / 2 + 0.03
  addBox(
    group,
    { w: doorW, h: H - 0.02, d: 0.01, x: -W / 4, y: H / 2, z: D / 2 - 0.005 },
    steel,
    'pensile-door',
  )
  addBox(
    group,
    { w: doorW, h: H - 0.02, d: 0.01, x: W / 4, y: H / 2, z: D / 2 - 0.02 },
    steel,
    'pensile-door',
  )
  for (const [x, z] of [
    [-W / 2 + 0.06, D / 2 + 0.002],
    [W / 2 - 0.06, D / 2 - 0.013],
  ] as const) {
    addBox(group, { w: 0.015, h: 0.12, d: 0.008, x, y: H / 2, z }, dark, 'pensile-handle')
  }
  return group
}

/** Wall-hung hand basin: shell with a sunken bowl, back upstand, tap and the trap below. */
export function buildLavamaniGeometry(node: EquipmentNode): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const steel = new MeshStandardMaterial(STAINLESS)
  const dark = new MeshStandardMaterial(STAINLESS_DARK)
  const rim = 0.03
  addBox(group, { w: W, h: H * 0.35, d: D, y: H * 0.175 }, steel, 'lavamani-body')
  addBox(
    group,
    { w: rim, h: H * 0.65, d: D, x: -W / 2 + rim / 2, y: H * 0.675 },
    steel,
    'lavamani-rim',
  )
  addBox(
    group,
    { w: rim, h: H * 0.65, d: D, x: W / 2 - rim / 2, y: H * 0.675 },
    steel,
    'lavamani-rim',
  )
  addBox(
    group,
    { w: W, h: H * 0.65, d: rim, y: H * 0.675, z: D / 2 - rim / 2 },
    steel,
    'lavamani-rim',
  )
  addBox(
    group,
    { w: W, h: H + 0.12, d: rim, y: (H + 0.12) / 2, z: -D / 2 + rim / 2 },
    steel,
    'lavamani-back',
  )
  addBox(group, { w: W - 2 * rim, h: 0.005, d: D - 2 * rim, y: H * 0.36 }, dark, 'lavamani-bowl')
  cylinder(group, 0.012, 0.2, dark, 'lavamani-tap', { y: H + 0.1, z: -D / 2 + 0.05 })
  addBox(
    group,
    { w: 0.02, h: 0.02, d: 0.14, y: H + 0.19, z: -D / 2 + 0.11 },
    dark,
    'lavamani-spout',
  )
  cylinder(group, 0.02, 0.25, dark, 'lavamani-trap', { y: -0.125 })
  return group
}

/** Front-loading cabinet on a plinth: shared by the dishwasher and the blast chiller. */
function frontCabinet(node: EquipmentNode, prefix: string, door: 'drop' | 'side', grille: boolean) {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const steel = new MeshStandardMaterial(STAINLESS)
  const dark = new MeshStandardMaterial(STAINLESS_DARK)
  const gasket = new MeshStandardMaterial(GASKET)
  const plinth = Math.min(PLINTH, H * 0.12)
  const panel = Math.min(0.1, H * 0.12)
  addBox(group, { w: W * 0.94, h: plinth, d: D * 0.9, y: plinth / 2 }, gasket, `${prefix}-plinth`)
  addBox(
    group,
    { w: W, h: H - plinth, d: D - 0.02, y: plinth + (H - plinth) / 2, z: -0.01 },
    steel,
    `${prefix}-body`,
  )
  const grilleH = grille ? Math.min(0.12, H * 0.15) : 0
  const doorBottom = plinth + grilleH
  const doorTop = H - panel
  const doorH = doorTop - doorBottom
  addBox(
    group,
    { w: W - 0.02, h: doorH - 0.01, d: 0.02, y: doorBottom + doorH / 2, z: D / 2 - 0.01 },
    steel,
    `${prefix}-door`,
  )
  if (door === 'drop') {
    addBox(
      group,
      { w: W * 0.6, h: 0.02, d: 0.03, y: doorTop - 0.05, z: D / 2 + 0.01 },
      dark,
      `${prefix}-handle`,
    )
  } else {
    addBox(
      group,
      {
        w: 0.025,
        h: doorH * 0.5,
        d: 0.03,
        x: W / 2 - 0.06,
        y: doorBottom + doorH / 2,
        z: D / 2 + 0.01,
      },
      dark,
      `${prefix}-handle`,
    )
  }
  addBox(
    group,
    { w: W * 0.25, h: panel * 0.5, d: 0.005, x: W / 2 - W * 0.18, y: H - panel / 2, z: D / 2 },
    new MeshStandardMaterial(BLACK_GLASS),
    `${prefix}-display`,
  )
  if (grille) {
    const slats = Math.max(3, Math.round(grilleH / 0.02))
    for (let i = 0; i < slats; i++) {
      const y = plinth + (grilleH * (i + 0.5)) / slats
      addBox(group, { w: W * 0.8, h: 0.006, d: 0.01, y, z: D / 2 }, gasket, `${prefix}-grille`)
    }
  }
  return group
}

/** Undercounter dishwasher: drop-down door with a bar handle, controls on top. */
export function buildLavastoviglieGeometry(node: EquipmentNode): Group {
  return frontCabinet(node, 'lavastoviglie', 'drop', false)
}

/** Blast chiller: side-hinged door, vent grille at the bottom, display on the control strip. */
export function buildAbbattitoreGeometry(node: EquipmentNode): Group {
  return frontCabinet(node, 'abbattitore', 'side', true)
}

/** Batch freezer: steel cabinet, hopper lid on top, horizontal dispensing barrel on the front. */
export function buildMantecatoreGeometry(node: EquipmentNode): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const steel = new MeshStandardMaterial(STAINLESS)
  const dark = new MeshStandardMaterial(STAINLESS_DARK)
  const castorH = castors(group, W, D, new MeshStandardMaterial(GASKET), 'mantecatore-castor')
  const body = H * 0.72 - castorH
  addBox(group, { w: W, h: body, d: D, y: castorH + body / 2 }, steel, 'mantecatore-body')
  // Upper section, set back: holds the cylinder and the hopper.
  const upper = H - castorH - body
  addBox(
    group,
    { w: W, h: upper, d: D * 0.7, y: castorH + body + upper / 2, z: -D * 0.15 },
    steel,
    'mantecatore-upper',
  )
  addBox(
    group,
    { w: W * 0.6, h: 0.03, d: D * 0.4, y: H + 0.015, z: -D * 0.15 },
    dark,
    'mantecatore-lid',
  )
  const barrelY = castorH + body + upper * 0.45
  cylinder(
    group,
    Math.min(0.12, W / 4),
    D * 0.3,
    dark,
    'mantecatore-barrel',
    { y: barrelY, z: D * 0.2 + 0.02 },
    'z',
  )
  addBox(
    group,
    { w: W * 0.4, h: 0.02, d: D * 0.25, y: castorH + body + 0.01, z: D * 0.37 },
    dark,
    'mantecatore-chute',
  )
  addBox(
    group,
    {
      w: 0.01,
      h: upper * 0.5,
      d: D * 0.3,
      x: W / 2 + 0.005,
      y: castorH + body + upper * 0.6,
      z: -D * 0.1,
    },
    new MeshStandardMaterial(DISPLAY_BLUE),
    'mantecatore-display',
  )
  return group
}

/** Pasteuriser: steel base on castors with a vertical tank and a front tap. */
export function buildPastorizzatoreGeometry(node: EquipmentNode): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const steel = new MeshStandardMaterial(STAINLESS)
  const dark = new MeshStandardMaterial(STAINLESS_DARK)
  const castorH = castors(group, W, D, new MeshStandardMaterial(GASKET), 'pastorizzatore-castor')
  const base = H * 0.6 - castorH
  addBox(group, { w: W, h: base, d: D, y: castorH + base / 2 }, steel, 'pastorizzatore-body')
  const tankH = H - castorH - base
  const r = Math.min(W, D) * 0.42
  cylinder(group, r, tankH, steel, 'pastorizzatore-tank', {
    y: castorH + base + tankH / 2,
    z: -D * 0.1,
  })
  cylinder(group, r * 1.02, 0.03, dark, 'pastorizzatore-lid', { y: H + 0.015, z: -D * 0.1 })
  cylinder(
    group,
    0.025,
    0.12,
    dark,
    'pastorizzatore-tap',
    { y: castorH + base * 0.85, z: D / 2 + 0.06 },
    'z',
  )
  return group
}

/** Upright fridge: white cabinet, fridge door above a freezer door, bar handles. */
export function buildFrigoriferoGeometry(node: EquipmentNode): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const white = new MeshStandardMaterial(PANEL_WHITE)
  const handle = new MeshStandardMaterial(STAINLESS)
  addBox(group, { w: W, h: H, d: D - 0.04, y: H / 2, z: -0.02 }, white, 'frigorifero-body')
  const split = H * 0.38
  addBox(
    group,
    { w: W - 0.01, h: split - 0.015, d: 0.04, y: split / 2, z: D / 2 - 0.02 },
    white,
    'frigorifero-door',
  )
  addBox(
    group,
    { w: W - 0.01, h: H - split - 0.015, d: 0.04, y: split + (H - split) / 2, z: D / 2 - 0.02 },
    white,
    'frigorifero-door',
  )
  addBox(
    group,
    { w: 0.02, h: split * 0.5, d: 0.03, x: -W / 2 + 0.05, y: split * 0.6, z: D / 2 + 0.015 },
    handle,
    'frigorifero-handle',
  )
  addBox(
    group,
    {
      w: 0.02,
      h: (H - split) * 0.35,
      d: 0.03,
      x: -W / 2 + 0.05,
      y: split + 0.25,
      z: D / 2 + 0.015,
    },
    handle,
    'frigorifero-handle',
  )
  return group
}

/** Mobile ingredient bin: steel tub on castors with a lid. */
export function buildTramoggiaGeometry(node: EquipmentNode): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const steel = new MeshStandardMaterial(STAINLESS)
  const dark = new MeshStandardMaterial(STAINLESS_DARK)
  const castorH = castors(group, W, D, new MeshStandardMaterial(GASKET), 'tramoggia-castor')
  const tub = H - castorH - 0.03
  addBox(group, { w: W, h: tub, d: D, y: castorH + tub / 2 }, steel, 'tramoggia-body')
  addBox(group, { w: W + 0.01, h: 0.03, d: D + 0.01, y: H - 0.015 }, dark, 'tramoggia-lid')
  addBox(
    group,
    { w: W * 0.4, h: 0.02, d: 0.03, y: H - 0.06, z: D / 2 + 0.015 },
    dark,
    'tramoggia-handle',
  )
  return group
}
