import type { IconifyJSON } from '@iconify/react'

/**
 * Iconify icons normally come from api.iconify.design the first time they are shown, so without
 * internet (the desktop app) the buttons stay blank. These helpers find the icon names used in
 * the source and copy just those icons out of the `@iconify-json/*` sets, to ship with the app.
 */

/** The sets the source uses; a new one goes here and in package.json (check its licence). */
export const ICON_SETS = [
  'carbon',
  'charm',
  'icon-park-outline',
  'lucide',
  'mdi',
  'ph',
  'qlementine-icons',
  'vaadin',
] as const

const NAME = /['"`]([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)['"`]/g

/** `prefix:name` strings of the given sets found in a source text. */
export function iconNamesIn(text: string, sets: readonly string[] = ICON_SETS): string[] {
  const names = new Set<string>()
  for (const [, prefix, name] of text.matchAll(NAME)) {
    if (prefix && name && sets.includes(prefix)) names.add(`${prefix}:${name}`)
  }
  return [...names]
}

/** The subset of a set holding `names` (aliases keep their parent). Missing names are returned. */
export function pickIcons(
  set: IconifyJSON,
  names: readonly string[],
): { collection: IconifyJSON; missing: string[] } {
  const icons: IconifyJSON['icons'] = {}
  const aliases: NonNullable<IconifyJSON['aliases']> = {}
  const missing: string[] = []
  const add = (name: string): boolean => {
    const icon = set.icons[name]
    if (icon) {
      icons[name] = icon
      return true
    }
    const alias = set.aliases?.[name]
    if (alias && add(alias.parent)) {
      aliases[name] = alias
      return true
    }
    return false
  }
  for (const name of [...names].sort()) if (!add(name)) missing.push(`${set.prefix}:${name}`)

  const collection: IconifyJSON = { prefix: set.prefix, icons }
  if (Object.keys(aliases).length) collection.aliases = aliases
  for (const key of ['width', 'height', 'left', 'top'] as const) {
    if (set[key] !== undefined) collection[key] = set[key]
  }
  return { collection, missing }
}
