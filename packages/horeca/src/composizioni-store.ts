import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Composizione } from './composizioni'

/** The saved compositions of this computer, like the catalog. */
export const useHorecaComposizioni = create<{
  composizioni: Composizione[]
  aggiungi: (list: Composizione[]) => void
  elimina: (id: string) => void
}>()(
  persist(
    (set) => ({
      composizioni: [],
      aggiungi: (list) =>
        set((s) => ({
          composizioni: [...s.composizioni, ...list].sort((a, b) =>
            a.nome.localeCompare(b.nome, 'it'),
          ),
        })),
      elimina: (id) => set((s) => ({ composizioni: s.composizioni.filter((c) => c.id !== id) })),
    }),
    {
      name: '3dcad-horeca:composizioni',
      storage: createJSONStorage(() =>
        typeof localStorage === 'undefined'
          ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
          : localStorage,
      ),
    },
  ),
)
