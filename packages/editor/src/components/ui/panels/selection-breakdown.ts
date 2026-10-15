/** Italian singular / plural per node type; unknown kinds keep their id. */
const TYPE_LABELS: Record<string, readonly [string, string]> = {
  item: ['oggetto', 'oggetti'],
  wall: ['muro', 'muri'],
  door: ['porta', 'porte'],
  window: ['finestra', 'finestre'],
  slab: ['solaio', 'solai'],
  ceiling: ['soffitto', 'soffitti'],
  column: ['pilastro', 'pilastri'],
  elevator: ['ascensore', 'ascensori'],
  fence: ['recinzione', 'recinzioni'],
  roof: ['tetto', 'tetti'],
  'roof-segment': ['falda', 'falde'],
  stair: ['scala', 'scale'],
  'stair-segment': ['rampa', 'rampe'],
  scan: ['scansione', 'scansioni'],
  guide: ['immagine di riferimento', 'immagini di riferimento'],
  zone: ['zona', 'zone'],
  cabinet: ['mobile', 'mobili'],
  'cabinet-module': ['mobile modulare', 'mobili modulari'],
  shelf: ['scaffale', 'scaffali'],
  measurement: ['misura', 'misure'],
  'construction-dimension': ['quota', 'quote'],
  'floor-opening': ['apertura', 'aperture'],
  'duct-segment': ['canale', 'canali'],
  'duct-fitting': ['raccordo', 'raccordi'],
  'duct-terminal': ['bocchetta', 'bocchette'],
  'pipe-trap': ['sifone', 'sifoni'],
  lineset: ['linea frigorifera', 'linee frigorifere'],
  'liquid-line': ['linea del liquido', 'linee del liquido'],
  skylight: ['lucernario', 'lucernari'],
  chimney: ['comignolo', 'comignoli'],
  gutter: ['grondaia', 'grondaie'],
  downspout: ['pluviale', 'pluviali'],
  'solar-panel': ['pannello solare', 'pannelli solari'],
  dormer: ['abbaino', 'abbaini'],
}

/**
 * "1 solaio · 1 scala · 2 recinzioni" — one entry per node type in
 * first-appearance order so the line stays stable while shift-clicking.
 * Known kinds use their Italian singular/plural; others fall back to the type
 * id ('hvac-equipment' → 'hvac equipment'). Missing nodes (stale ids) are skipped.
 */
export function formatSelectionBreakdown(types: Array<string | null | undefined>): string {
  const counts = new Map<string, number>()
  for (const type of types) {
    if (!type) continue
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  const parts: string[] = []
  for (const [type, count] of counts) {
    const labels = TYPE_LABELS[type]
    const label = labels ? labels[count === 1 ? 0 : 1] : type.replace(/-/g, ' ')
    parts.push(`${count} ${label}`)
  }
  return parts.join(' · ')
}
