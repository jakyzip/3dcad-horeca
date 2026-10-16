import { type AnyNodeId, sceneRegistry } from '@pascal-app/core'
import {
  type BatchedMesh,
  Box3,
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Color,
  DataTexture,
  DataUtils,
  DirectionalLight,
  EquirectangularReflectionMapping,
  HalfFloatType,
  type InstancedMesh,
  LinearFilter,
  type Material,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  type Object3D,
  RGBAFormat,
  Scene,
  type Texture,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Layer 0, where the room itself is drawn; editing overlays, zones and the grid sit above. */
const SCENE_LAYER_MASK = 1

type Drawable = Mesh | InstancedMesh | BatchedMesh

/** True when the object and every ancestor up to the scene are shown. */
function shown(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false
  return true
}

function drawable(object: Object3D): object is Drawable {
  const o = object as Partial<Mesh> & { isSkinnedMesh?: boolean; isBatchedMesh?: boolean }
  return Boolean(o.isMesh || o.isBatchedMesh) && !o.isSkinnedMesh && Boolean(o.geometry)
}

/** Whether a material paints the room, as opposed to a hit area, an outline or a mask. */
function paints(material: Material): boolean {
  return material.visible && material.colorWrite !== false && !(material.opacity < 0.02)
}

type Readable = Partial<{
  color: Color
  map: Texture | null
  roughness: number
  roughnessMap: Texture | null
  metalness: number
  metalnessMap: Texture | null
  normalMap: Texture | null
  emissive: Color
  emissiveIntensity: number
  emissiveMap: Texture | null
  alphaMap: Texture | null
  transmission: number
  ior: number
  thickness: number
  vertexColors: boolean
}>

/**
 * The same look as a plain physical material: what the path tracer reads. The viewer's node
 * materials carry these fields too; anything drawn only by shader nodes keeps its base colour.
 */
function physical(source: Material): MeshPhysicalMaterial {
  const m = source as Material & Readable
  return new MeshPhysicalMaterial({
    color: m.color ? m.color.clone() : new Color(0xffffff),
    map: m.map ?? null,
    roughness: m.roughness ?? 1,
    roughnessMap: m.roughnessMap ?? null,
    metalness: m.metalness ?? 0,
    metalnessMap: m.metalnessMap ?? null,
    normalMap: m.normalMap ?? null,
    emissive: m.emissive ? m.emissive.clone() : new Color(0x000000),
    emissiveIntensity: m.emissiveIntensity ?? 1,
    emissiveMap: m.emissiveMap ?? null,
    alphaMap: m.alphaMap ?? null,
    transmission: m.transmission ?? 0,
    ior: m.ior ?? 1.5,
    thickness: m.thickness ?? 0,
    vertexColors: m.vertexColors ?? false,
    opacity: source.opacity,
    transparent: source.transparent,
    side: source.side,
  })
}

/**
 * The viewer's sky light is a 32-bit float texture with nearest filtering, which WebGPU cannot
 * sample through a sampler, and the path tracer samples it that way: the same picture in 16-bit
 * floats, filtered.
 */
function filterableSky(texture: Texture | null): Texture | null {
  const data = (texture as DataTexture | null)?.image?.data
  if (!(texture && data instanceof Float32Array)) return texture
  const { width, height } = (texture as DataTexture).image
  const half = new Uint16Array(data.length)
  for (let i = 0; i < data.length; i++) half[i] = DataUtils.toHalfFloat(data[i]!)
  const out = new DataTexture(half, width, height, RGBAFormat, HalfFloatType)
  out.mapping = EquirectangularReflectionMapping
  out.minFilter = LinearFilter
  out.magFilter = LinearFilter
  out.colorSpace = texture.colorSpace
  out.needsUpdate = true
  return out
}

type BatchRange = {
  vertexStart: number
  vertexCount: number
  indexStart: number
  indexCount: number
}
type BatchInternals = {
  _instanceInfo: Array<{ active: boolean; visible: boolean }>
  _colorsTexture: unknown
  getGeometryRangeAt: (geometryId: number) => BatchRange
}

/** One geometry of a batch, as a geometry of its own with only its vertices. */
function batchPiece(geometry: BufferGeometry, range: BatchRange): BufferGeometry {
  const out = new BufferGeometry()
  const { vertexStart, vertexCount } = range
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const size = attribute.itemSize
    const array = new Float32Array(vertexCount * size)
    for (let i = 0; i < vertexCount; i++)
      for (let k = 0; k < size; k++)
        array[i * size + k] = attribute.getComponent(vertexStart + i, k)
    out.setAttribute(name, new BufferAttribute(array, size, attribute.normalized))
  }
  const index = geometry.index
  if (index) {
    const indices = new Uint32Array(range.indexCount)
    for (let i = 0; i < range.indexCount; i++)
      indices[i] = index.getX(range.indexStart + i) - vertexStart
    out.setIndex(new BufferAttribute(indices, 1))
  }
  return out
}

/** Every surface in the same shape: no index, world space, position + normal + uv + colour. */
function worldGeometry(source: BufferGeometry, matrix: Matrix4): BufferGeometry {
  const flat = source.index ? source.toNonIndexed() : source
  const count = flat.attributes.position!.count
  const out = new BufferGeometry()
  const copy = (name: string, size: number, fill: number) => {
    const attribute = flat.attributes[name]
    const array = new Float32Array(count * size).fill(fill)
    if (attribute)
      for (let i = 0; i < count; i++)
        for (let k = 0; k < Math.min(size, attribute.itemSize); k++)
          array[i * size + k] = attribute.getComponent(i, k)
    out.setAttribute(name, new BufferAttribute(array, size))
    return Boolean(attribute)
  }
  copy('position', 3, 0)
  const hasNormals = copy('normal', 3, 0)
  copy('uv', 2, 0)
  copy('color', 3, 1)
  for (const g of flat.groups) out.addGroup(g.start, g.count, g.materialIndex)
  if (flat !== source) flat.dispose()
  if (!hasNormals) out.computeVertexNormals()
  out.applyMatrix4(matrix)
  return out
}

/** Vertices `start` … `start + count` of a non-indexed geometry, as a geometry of their own. */
function slice(geometry: BufferGeometry, start: number, count: number): BufferGeometry {
  const total = geometry.attributes.position!.count
  const end = Math.min(total, start + count)
  const out = new BufferGeometry()
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const size = attribute.itemSize
    const array = (attribute.array as Float32Array).slice(start * size, end * size)
    out.setAttribute(name, new BufferAttribute(array, size))
  }
  return out
}

/**
 * Ceilings and roofs, split by the camera's height. Those it looks down on are left out: the view
 * draws a ceiling only from below, so from above you see into the room. Those over the camera stay
 * in the picture but let the sun and the sky through, as a photographer's set lights a room: a
 * closed room otherwise only gets the light from its door and comes out nearly black.
 */
function overhead(camera: Camera): { below: Set<Object3D>; above: Set<Object3D> } {
  const below = new Set<Object3D>()
  const above = new Set<Object3D>()
  const box = new Box3()
  for (const kind of ['ceiling', 'roof'])
    for (const id of sceneRegistry.byType[kind] ?? []) {
      const object = sceneRegistry.nodes.get(id as AnyNodeId)
      if (!object) continue
      if (box.setFromObject(object).max.y < camera.position.y) below.add(object)
      else above.add(object)
    }
  return { below, above }
}

/**
 * A still copy of what the 3D view shows, for the path tracer: the meshes on the room's layer
 * that are visible now, frozen where they stand, with physical materials; the sun and the sky
 * light as they are. Geometry is copied, since the path tracer adds attributes to what it gets.
 * `dispose` frees the copies.
 */
export function sceneForPathTracing(
  source: Scene,
  camera: Camera,
): { scene: Scene; dispose: () => void } {
  source.updateMatrixWorld(true)
  const { below, above } = overhead(camera)
  const scene = new Scene()
  const materials = new Map<Material, MeshPhysicalMaterial>()
  const convert = (m: Material) => {
    let out = materials.get(m)
    if (!out) {
      out = physical(m)
      materials.set(m, out)
    }
    return out
  }
  const owned: Array<{ dispose: () => void }> = []

  // Every surface is gathered in world space by material, then merged: one plain geometry per
  // material (and per lid state). The path tracer builds a BVH root per geometry group and packs
  // at most 128 of them, which a tiled wall or a long scene of separate parts can exceed.
  const tinted = new Map<string, MeshPhysicalMaterial>()
  const parts = new Map<
    string,
    { material: MeshPhysicalMaterial; lid: boolean; pieces: BufferGeometry[] }
  >()
  const collect = (
    geometry: BufferGeometry,
    matrix: Matrix4,
    material: Material | Material[],
    lid: boolean,
    tint?: Color,
  ) => {
    const world = worldGeometry(geometry, matrix)
    const ranges: Array<{ start: number; count: number; material: Material | undefined }> =
      Array.isArray(material)
        ? (world.groups.length
            ? world.groups
            : [{ start: 0, count: Infinity, materialIndex: 0 }]
          ).map((g) => ({
            start: g.start,
            count: g.count,
            material: material[g.materialIndex ?? 0],
          }))
        : [{ start: 0, count: Infinity, material }]
    for (const range of ranges) {
      if (!(range.material && paints(range.material))) continue
      let converted = convert(range.material)
      if (tint) {
        const key = `${converted.uuid}:${tint.getHexString()}`
        const known = tinted.get(key)
        if (known) converted = known
        else {
          const copy = converted.clone()
          copy.color.multiply(tint)
          tinted.set(key, copy)
          converted = copy
        }
      }
      const piece = Array.isArray(material) ? slice(world, range.start, range.count) : world
      const key = `${converted.uuid}:${lid}`
      const entry = parts.get(key)
      if (entry) entry.pieces.push(piece)
      else parts.set(key, { material: converted, lid, pieces: [piece] })
    }
    // Sliced by material: the whole is no longer needed.
    if (Array.isArray(material)) world.dispose()
  }

  source.traverse((object) => {
    // `traverse` still walks into what is skipped here: check the ancestors each time.
    let lid = false
    for (let o: Object3D | null = object; o; o = o.parent) {
      if (below.has(o) || (o.userData as { excludeFromCapture?: unknown }).excludeFromCapture)
        return
      if (above.has(o)) lid = true
    }
    if (!drawable(object)) {
      const light = object as DirectionalLight
      if (light.isDirectionalLight && shown(light) && light.intensity > 0) {
        const sun = new DirectionalLight(light.color, light.intensity)
        sun.position.setFromMatrixPosition(light.matrixWorld)
        sun.target.position.setFromMatrixPosition(light.target.matrixWorld)
        scene.add(sun, sun.target)
      }
      return
    }
    if ((object.layers.mask & SCENE_LAYER_MASK) === 0 || !shown(object)) return
    const list = Array.isArray(object.material) ? object.material : [object.material]
    if (!list.some(paints)) return

    if ((object as BatchedMesh).isBatchedMesh) {
      // The editor packs many small parts into one batch: each instance is taken on its own.
      const batch = object as BatchedMesh
      const internals = batch as unknown as BatchInternals
      const pieces = new Map<number, BufferGeometry>()
      const instance = new Matrix4()
      const matrix = new Matrix4()
      internals._instanceInfo.forEach((info, i) => {
        if (!(info.active && info.visible)) return
        const geometryId = batch.getGeometryIdAt(i)
        let geometry = pieces.get(geometryId)
        if (!geometry) {
          geometry = batchPiece(batch.geometry, internals.getGeometryRangeAt(geometryId))
          pieces.set(geometryId, geometry)
        }
        batch.getMatrixAt(i, instance)
        matrix.multiplyMatrices(batch.matrixWorld, instance)
        let tint: Color | undefined
        if (internals._colorsTexture) {
          tint = new Color()
          batch.getColorAt(i, tint)
        }
        collect(geometry, matrix, batch.material as Material, lid, tint)
      })
      for (const geometry of pieces.values()) geometry.dispose()
      return
    }

    const mesh = object as Mesh
    collect(mesh.geometry, mesh.matrixWorld, mesh.material, lid)
  })

  for (const { material, lid, pieces } of parts.values()) {
    const merged = pieces.length === 1 ? pieces[0]! : mergeGeometries(pieces, false)
    if (!merged) continue
    if (merged !== pieces[0]) for (const piece of pieces) piece.dispose()
    owned.push(merged)
    const mesh = new Mesh(merged, material)
    /** Read by the path tracer: rays looking for the sun or the sky pass through. */
    if (lid) (mesh as Mesh & { visibleToShadowRays?: boolean }).visibleToShadowRays = false
    scene.add(mesh)
  }
  for (const material of tinted.values()) owned.push(material)

  scene.environment = filterableSky(source.environment)
  if (scene.environment && scene.environment !== source.environment) owned.push(scene.environment)
  scene.environmentIntensity = source.environmentIntensity
  scene.background = source.background
  for (const m of materials.values()) owned.push(m)
  return {
    scene,
    dispose: () => {
      for (const o of owned) o.dispose()
    },
  }
}
