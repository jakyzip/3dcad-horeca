import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { readProductRef } from './product'
import type { EquipmentNode } from './schema'

/**
 * The text above a unit in the 3D view: what it is, in words (the article name), since the code
 * is already written in the plan. Falls back to the node name, then to the kind ("Mantecatore").
 */
export function label3dText(node: EquipmentNode, kindLabel: string): string {
  const read = readProductRef(node.metadata)
  const article = read.kind === 'article' || read.kind === 'local' ? read.ref.name : ''
  return article.trim() || node.name?.trim() || kindLabel
}

/** Whether the 3D labels are shown: a workstation preference, like the catalog. */
export const useHorecaLabels = create<{ shown: boolean; setShown: (shown: boolean) => void }>()(
  persist((set) => ({ shown: true, setShown: (shown) => set({ shown }) }), {
    name: '3dcad-horeca:etichette',
    storage: createJSONStorage(() =>
      typeof localStorage === 'undefined'
        ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
        : localStorage,
    ),
  }),
)
