import { createRequire } from 'node:module'
import path from 'node:path'

/**
 * WebAssembly decoders the editor would otherwise fetch from CDNs (gstatic.com, jsdelivr):
 * Draco for compressed models, Basis for KTX2 textures, manifold for 3D-print export. They are
 * copied from the installed packages into `public/decoders`, so the app works offline; the
 * test keeps the copies identical to the packages after an update.
 */
export const DECODER_FILES: Record<string, string> = {
  'draco/draco_decoder.js': 'three/examples/jsm/libs/draco/gltf/draco_decoder.js',
  'draco/draco_decoder.wasm': 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm',
  'draco/draco_wasm_wrapper.js': 'three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js',
  'basis/basis_transcoder.js': 'three/examples/jsm/libs/basis/basis_transcoder.js',
  'basis/basis_transcoder.wasm': 'three/examples/jsm/libs/basis/basis_transcoder.wasm',
  'manifold/manifold.js': 'manifold-3d/manifold.js',
  'manifold/manifold.wasm': 'manifold-3d/manifold.wasm',
}

export const DECODERS_DIRECTORY = path.resolve(import.meta.dirname, '../public/decoders')

const require = createRequire(
  path.resolve(import.meta.dirname, '../../../packages/editor/package.json'),
)

/** Where a decoder file sits in node_modules (three and manifold-3d resolve from the editor package). */
export const decoderSource = (module: string) => require.resolve(module)
