import { BoxGeometry, type Group, type Material, Mesh } from 'three'

// Medium-quality looks (see CLAUDE.md): flat PBR colours, no textures.
export const STAINLESS = { color: '#c9ccd1', metalness: 0.75, roughness: 0.35 }
export const STAINLESS_DARK = { color: '#8d939b', metalness: 0.7, roughness: 0.45 }
export const PANEL_WHITE = { color: '#eef0f2', metalness: 0.1, roughness: 0.6 }
export const GASKET = { color: '#2b2d31', metalness: 0, roughness: 0.8 }

export const PLINTH = 0.1
export const GAP = 0.004

export type Box = { w: number; h: number; d: number; x?: number; y: number; z?: number }

export function addBox(group: Group, box: Box, material: Material, name: string) {
  const mesh = new Mesh(new BoxGeometry(box.w, box.h, box.d), material)
  mesh.position.set(box.x ?? 0, box.y, box.z ?? 0)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}
