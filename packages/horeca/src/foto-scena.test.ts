import { describe, expect, test } from 'bun:test'
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
    expect(copy!.matrix.elements.slice(12, 15)).toEqual([2, 1, 0])
    const material = copy!.material as MeshStandardMaterial & { isMeshPhysicalMaterial: boolean }
    expect(material.isMeshPhysicalMaterial).toBe(true)
    expect(material.color.getHex()).toBe(0x336699)
    expect(material.roughness).toBeCloseTo(0.4)
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

  test('splits a batch into one mesh per visible instance, each with its own vertices', () => {
    const source = new Scene()
    const batch = new BatchedMesh(4, 200, 400, new MeshStandardMaterial())
    const small = batch.addGeometry(new BoxGeometry(1, 1, 1))
    const big = batch.addGeometry(new BoxGeometry(2, 2, 2))
    batch.setMatrixAt(batch.addInstance(small), new Matrix4().makeTranslation(1, 0, 0))
    batch.setMatrixAt(batch.addInstance(big), new Matrix4().makeTranslation(0, 0, 5))
    batch.setVisibleAt(batch.addInstance(small), false)
    source.add(batch)

    const copies = meshes(sceneForPathTracing(source, camera).scene)
    expect(copies).toHaveLength(2)
    expect(copies[0]!.geometry.attributes.position!.count).toBe(24)
    expect(copies[0]!.matrix.elements.slice(12, 15)).toEqual([1, 0, 0])
    expect(copies[1]!.matrix.elements.slice(12, 15)).toEqual([0, 0, 5])
    copies[1]!.geometry.computeBoundingBox()
    expect(copies[1]!.geometry.boundingBox!.max.x).toBeCloseTo(1)
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
})
