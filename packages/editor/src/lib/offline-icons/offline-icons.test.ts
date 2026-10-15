import { describe, expect, test } from 'bun:test'
import path from 'node:path'
import type { IconifyJSON } from '@iconify/react'
import { iconNamesIn, pickIcons } from './collect'
import collections from './icons.json'
import { sourceIconNames } from './source'

describe('offline icons', () => {
  test('finds icon names of known sets only', () => {
    const text = `icon="lucide:x" name: 'mdi:cancel' sfx: 'sfx:grid-snap' \`ph:mouse-left-click-fill\``
    expect(iconNamesIn(text).sort()).toEqual(['lucide:x', 'mdi:cancel', 'ph:mouse-left-click-fill'])
  })

  test('copies icons, aliases with their parent, and reports missing ones', () => {
    const set: IconifyJSON = {
      prefix: 'demo',
      width: 24,
      icons: { a: { body: '<path/>' }, b: { body: '<g/>' } },
      aliases: { c: { parent: 'a' } },
    }
    const { collection, missing } = pickIcons(set, ['c', 'zzz'])
    expect(collection).toEqual({
      prefix: 'demo',
      width: 24,
      icons: { a: { body: '<path/>' } },
      aliases: { c: { parent: 'a' } },
    })
    expect(missing).toEqual(['demo:zzz'])
  })

  test('every icon in the source ships with the editor (else: bun scripts/offline-icons.ts)', () => {
    const shipped = new Set(
      (collections as unknown as IconifyJSON[]).flatMap((c) =>
        [...Object.keys(c.icons), ...Object.keys(c.aliases ?? {})].map((n) => `${c.prefix}:${n}`),
      ),
    )
    const repo = path.resolve(import.meta.dir, '../../../../..')
    expect(sourceIconNames(repo).filter((n) => !shipped.has(n))).toEqual([])
  })
})
