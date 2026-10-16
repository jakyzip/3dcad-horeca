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

/**
 * Ceilings the camera looks down on. The view draws a ceiling only from below, so from above
 * you see into the room; the path tracer would still stop the light there and leave the room
 * dark under a lid.
 */
function ceilingsBelow(camera: Camera): Set<Object3D> {
  const out = new Set<Object3D>()
  const box = new Box3()
  for (const id of sceneRegistry.byType.ceiling ?? []) {
    const object = sceneRegistry.nodes.get(id as AnyNodeId)
    if (object && box.setFromObject(object).max.y < camera.position.y) out.add(object)
  }
  return out
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
  const skipped = ceilingsBelow(camera)
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

  source.traverse((object) => {
    // `traverse` still walks into what is skipped here: check the ancestors each time.
    for (let o: Object3D | null = object; o; o = o.parent)
      if (skipped.has(o) || (o.userData as { excludeFromCapture?: unknown }).excludeFromCapture)
        return
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
      // The editor packs many small parts into one batch; the path tracer wants each on its own.
      const batch = object as BatchedMesh
      const internals = batch as unknown as BatchInternals
      const pieces = new Map<number, BufferGeometry>()
      const tinted = new Map<string, MeshPhysicalMaterial>()
      const base = convert(batch.material as Material)
      const instance = new Matrix4()
      const tint = new Color()
      internals._instanceInfo.forEach((info, i) => {
        if (!(info.active && info.visible)) return
        const geometryId = batch.getGeometryIdAt(i)
        let geometry = pieces.get(geometryId)
        if (!geometry) {
          geometry = batchPiece(batch.geometry, internals.getGeometryRangeAt(geometryId))
          pieces.set(geometryId, geometry)
          owned.push(geometry)
        }
        let material = base
        if (internals._colorsTexture) {
          batch.getColorAt(i, tint)
          const key = tint.getHexString()
          material = tinted.get(key) ?? base.clone()
          if (!tinted.has(key)) {
            material.color.multiply(tint)
            tinted.set(key, material)
            owned.push(material)
          }
        }
        const mesh = new Mesh(geometry, material)
        batch.getMatrixAt(i, instance)
        mesh.matrix.multiplyMatrices(batch.matrixWorld, instance)
        mesh.matrixAutoUpdate = false
        scene.add(mesh)
      })
      return
    }

    const copy = object.clone(false) as Drawable
    copy.geometry = object.geometry.clone()
    owned.push(copy.geometry)
    copy.material = Array.isArray(object.material)
      ? object.material.map(convert)
      : convert(object.material)
    copy.matrix.copy(object.matrixWorld)
    copy.matrixAutoUpdate = false
    copy.matrixWorldNeedsUpdate = true
    scene.add(copy)
  })

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
