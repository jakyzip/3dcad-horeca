import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { INTESTAZIONE_VUOTA, type Intestazione } from './tavola'

/** The company's data and logo for the customer's sheet: set once per computer. */
export const useHorecaIntestazione = create<{
  intestazione: Intestazione
  set: (patch: Partial<Intestazione>) => void
}>()(
  persist(
    (set) => ({
      intestazione: INTESTAZIONE_VUOTA,
      set: (patch) => set((s) => ({ intestazione: { ...s.intestazione, ...patch } })),
    }),
    {
      name: '3dcad-horeca:intestazione',
      storage: createJSONStorage(() =>
        typeof localStorage === 'undefined'
          ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
          : localStorage,
      ),
    },
  ),
)

/** A logo file shrunk to fit 600 px, as a PNG data URL (keeps the stored settings small). */
export function logoDataUrl(file: File, max = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Il file non è un’immagine leggibile.'))
    }
    image.src = url
  })
}
