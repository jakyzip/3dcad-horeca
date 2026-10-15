/**
 * Copies the WebAssembly decoders into public/decoders (see lib/decoders.ts).
 * Run after updating three or manifold-3d:  bun scripts/copia-decoder.ts
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { DECODER_FILES, DECODERS_DIRECTORY, decoderSource } from '../lib/decoders'

for (const [target, module] of Object.entries(DECODER_FILES)) {
  const destination = path.join(DECODERS_DIRECTORY, target)
  mkdirSync(path.dirname(destination), { recursive: true })
  copyFileSync(decoderSource(module), destination)
}
console.log(`${Object.keys(DECODER_FILES).length} file in ${DECODERS_DIRECTORY}`)
