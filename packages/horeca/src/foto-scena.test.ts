import { describe, expect, test } from 'bun:test'
import { sceneRegistry } from '@pascal-app/core'
import {
  BatchedMesh,
  BoxGeometry,
  DataTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  FloatType,
  Group,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  Vector3,
} from 'three'
import { sceneForPathTracing } from './foto-scena'

const camera = new PerspectiveCamera()
const box = (material = new MeshStandardMaterial({ color: 0x336699, roughness: 0.4 })) =>
  new Mesh(new BoxGeometry(1, 1, 1), material)

const meshes = (scene: Scene) => {
  const out: Mesh[] = []
  scene.traverse((o: Object3D) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh)
  })
  return out
}

describe('sceneForPathTracing', () => {
  test('copies a visible mesh where it stands, with a physical material of the same look', () => {
    const source = new Scene()
    const group = new Group()
    group.position.set(2, 0, 0)
    const mesh = box()
    mesh.position.set(0, 1, 0)
    group.add(mesh)
    source.add(group)

    const { scene } = sceneForPathTracing(source, camera)
    const [copy] = meshes(scene)
    expect(meshes(scene)).toHaveLength(1)
    expect(copy!.geometry).not.toBe(mesh.geometry)
    // Baked into world space: the copy itself sits at the origin.
    copy!.geometry.computeBoundingBox()
    const centre = copy!.geometry.boundingBox!.getCenter(new Vector3())
    expect(centre.toArray()).toEqual([2, 1, 0])
    const material = copy!.material as MeshStandardMaterial & { isMeshPhysicalMaterial: boolean }
    expect(material.isMeshPhysicalMaterial).toBe(true)
    expect(material.color.getHex()).toBe(0x336699)
    expect(material.roughness).toBeCloseTo(0.4)
  })

  test('merges by material, so no geometry carries more groups than the tracer packs', () => {
    const source = new Scene()
    const steel = new MeshStandardMaterial({ color: 0xcccccc })
    const tiles = new BoxGeometry(1, 1, 1, 10, 10, 2)
    // A tiled wall: hundreds of groups over two materials.
    tiles.clearGroups()
    const triangles = tiles.index!.count / 3
    for (let i = 0; i < triangles; i++) tiles.addGroup(i * 3, 3, i % 2)
    expect(tiles.groups.length).toBeGreaterThan(128)
    source.add(new Mesh(tiles, [steel, new MeshStandardMaterial({ color: 0x2255aa })]))
    source.add(box(steel), box(steel))

    const copies = meshes(sceneForPathTracing(source, camera).scene)
    expect(copies).toHaveLength(2)
    expect(copies.every((m) => m.geometry.groups.length === 0)).toBe(true)
    expect(copies.every((m) => !Array.isArray(m.material))).toBe(true)
  })

  test('leaves out what the view does not draw as the room', () => {
    const source = new Scene()
    const hidden = new Group()
    hidden.visible = false
    hidden.add(box())
    const overlay = box()
    overlay.layers.set(1)
    const handles = new Group()
    handles.userData.excludeFromCapture = true
    handles.add(box())
    const hitArea = box(new MeshBasicMaterial({ visible: false }))
    source.add(hidden, overlay, handles, hitArea, box())

    expect(meshes(sceneForPathTracing(source, camera).scene)).toHaveLength(1)
  })

  test('takes each visible instance of a batch where it stands, hidden ones left out', () => {
    const source = new Scene()
    const batch = new BatchedMesh(4, 200, 400, new MeshStandardMaterial())
    const small = batch.addGeometry(new BoxGeometry(1, 1, 1))
    const big = batch.addGeometry(new BoxGeometry(2, 2, 2))
    batch.setMatrixAt(batch.addInstance(small), new Matrix4().makeTranslation(1, 0, 0))
    batch.setMatrixAt(batch.addInstance(big), new Matrix4().makeTranslation(0, 0, 5))
    batch.setVisibleAt(batch.addInstance(small), false)
    source.add(batch)

    const copies = meshes(sceneForPathTracing(source, camera).scene)
    expect(copies).toHaveLength(1)
    // Two boxes of 36 corners each (no index): the hidden third is not there.
    expect(copies[0]!.geometry.attributes.position!.count).toBe(72)
    copies[0]!.geometry.computeBoundingBox()
    const { min, max } = copies[0]!.geometry.boundingBox!
    expect(max.x).toBeCloseTo(1.5)
    expect(max.z).toBeCloseTo(6)
    expect(min.z).toBeCloseTo(-0.5)
  })

  test('keeps the sun and gives the sky light a filterable copy', () => {
    const source = new Scene()
    const sun = new DirectionalLight(0xffffff, 2)
    sun.position.set(3, 10, 2)
    source.add(sun, sun.target)
    const sky = new DataTexture(new Float32Array(2 * 1 * 4).fill(0.5), 2, 1, RGBAFormat, FloatType)
    sky.mapping = EquirectangularReflectionMapping
    source.environment = sky

    const { scene } = sceneForPathTracing(source, camera)
    const lights = scene.children.filter((o) => (o as DirectionalLight).isDirectionalLight)
    expect(lights).toHaveLength(1)
    expect((lights[0] as DirectionalLight).intensity).toBe(2)
    expect(lights[0]!.position.toArray()).toEqual([3, 10, 2])
    const copy = scene.environment as DataTexture
    expect(copy.type).toBe(HalfFloatType)
    expect(copy.minFilter).toBe(LinearFilter)
    expect(copy.magFilter).toBe(LinearFilter)
    expect(copy.mapping).toBe(EquirectangularReflectionMapping)
  })

  test('a ceiling is left out seen from above, and lets the light through seen from below', () => {
    const source = new Scene()
    const ceiling = new Group()
    const panel = box()
    panel.position.y = 2.5
    ceiling.add(panel)
    source.add(ceiling, box())
    source.updateMatrixWorld(true)
    sceneRegistry.nodes.set('ceiling_test', ceiling)
    sceneRegistry.byType.ceiling!.add('ceiling_test')
    try {
      const high = new PerspectiveCamera()
      high.position.set(0, 10, 5)
      expect(meshes(sceneForPathTracing(source, high).scene)).toHaveLength(1)

      const eye = new PerspectiveCamera()
      eye.position.set(0, 1.6, 2)
      const inside = meshes(sceneForPathTracing(source, eye).scene)
      expect(inside).toHaveLength(2)
      const flags = inside.map(
        (m) => (m as Mesh & { visibleToShadowRays?: boolean }).visibleToShadowRays,
      )
      expect(flags.sort()).toEqual([false, undefined])
    } finally {
      sceneRegistry.nodes.delete('ceiling_test')
      sceneRegistry.byType.ceiling!.delete('ceiling_test')
    }
  })
})
