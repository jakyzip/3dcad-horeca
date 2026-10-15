import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { crc32, zip } from './zip'

const text = (s: string) => new TextEncoder().encode(s)

describe('zip', () => {
  test('crc32 matches the standard check value', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926)
  })

  test('the archive lists every file and unzips to the same bytes', async () => {
    const archive = zip([
      { name: 'render-1.png', data: text('primo') },
      { name: 'vista-2.png', data: text('secondo, più lungo') },
    ])
    const dir = mkdtempSync(path.join(tmpdir(), 'zip-test-'))
    const file = path.join(dir, 'renders.zip')
    writeFileSync(file, archive)
    const listed = Bun.spawnSync(['unzip', '-l', file]).stdout.toString()
    expect(listed).toContain('render-1.png')
    expect(listed).toContain('vista-2.png')
    const out = Bun.spawnSync(['unzip', '-p', file, 'vista-2.png']).stdout.toString()
    expect(out).toBe('secondo, più lungo')
    const check = Bun.spawnSync(['unzip', '-t', file])
    expect(check.exitCode).toBe(0)
  })
})
