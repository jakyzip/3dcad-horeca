import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { iconNamesIn } from './collect'

const ROOTS = ['apps', 'packages']
const SKIP = new Set(['node_modules', 'dist', '.next', '.turbo', 'build', 'release'])

/** Every Iconify icon name in the app and package sources (tests excluded), sorted. */
export function sourceIconNames(repo: string): string[] {
  const names = new Set<string>()
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
        for (const name of iconNamesIn(readFileSync(full, 'utf8'))) names.add(name)
    }
  }
  for (const root of ROOTS) walk(path.join(repo, root))
  return [...names].sort()
}
