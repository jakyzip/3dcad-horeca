import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DECODER_FILES, DECODERS_DIRECTORY, decoderSource } from './decoders'

describe('offline decoders', () => {
  test('public copies match the installed packages (else: bun scripts/copia-decoder.ts)', () => {
    for (const [target, module] of Object.entries(DECODER_FILES)) {
      const copy = readFileSync(path.join(DECODERS_DIRECTORY, target))
      expect(copy.equals(readFileSync(decoderSource(module)))).toBe(true)
    }
  })
})
