/**
 * Writes `src/lib/offline-icons/icons.json`: every Iconify icon the source uses, copied out of
 * the `@iconify-json/*` sets so the editor shows them without internet.
 *
 *   bun scripts/offline-icons.ts
 *
 * Run it after adding an icon; the test `offline-icons.test.ts` fails until you do.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { IconifyJSON } from '@iconify/react'
import { ICON_SETS, pickIcons } from '../src/lib/offline-icons/collect'
import { sourceIconNames } from '../src/lib/offline-icons/source'

const repo = path.resolve(import.meta.dir, '../../..')
const out = path.resolve(import.meta.dir, '../src/lib/offline-icons/icons.json')

const names = sourceIconNames(repo)
const collections: IconifyJSON[] = []
const missing: string[] = []
for (const prefix of ICON_SETS) {
  const wanted = names
    .filter((n) => n.startsWith(`${prefix}:`))
    .map((n) => n.slice(prefix.length + 1))
  if (!wanted.length) continue
  const set = JSON.parse(
    readFileSync(require.resolve(`@iconify-json/${prefix}/icons.json`), 'utf8'),
  ) as IconifyJSON
  const picked = pickIcons(set, wanted)
  collections.push(picked.collection)
  missing.push(...picked.missing)
}

writeFileSync(out, `${JSON.stringify(collections, null, 1)}\n`)
console.log(`${names.length - missing.length} icone in ${path.relative(repo, out)}`)
if (missing.length) {
  console.error(`Icone che non esistono nei set installati: ${missing.join(', ')}`)
  process.exit(1)
}
