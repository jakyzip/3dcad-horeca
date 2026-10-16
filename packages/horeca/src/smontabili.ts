import { LAVELLO, TAVOLO, type Vasche } from './schema'

/**
 * Bolted-together stainless tables and sinks, "a giorno" (open, on legs), as the Ideam Ecoplus
 * line builds them: 40 × 40 square legs on adjustable feet, a worktop with a 40 mm edge, a welded
 * upstand at the back (then the legs stand 50 mm in from the back), a lower shelf or, without
 * one, rails between the legs. Their codes carry the sizes and the model, so an article picked
 * from the catalog gets its shape set from its code alone.
 */

/** Worktop height of the line: 850 mm on the feet screwed in, up to 900 mm. */
const ALTEZZA = 0.9

type Vasca = { larghezza: number; profondita: number; altezza: number }

const vasca = (larghezza: number, profondita: number, altezza: number): Vasca => ({
  larghezza: larghezza / 1000,
  profondita: profondita / 1000,
  altezza: altezza / 1000,
})

/**
 * The bowl the line puts in a sink of this width (dm) and depth (6 or 7 dm), as the price list
 * gives it: wider and deeper bowls in the bigger sinks.
 */
function vascaPer(vasche: Vasche, larghezza: number, profondita: number): Vasca {
  const fonda = profondita >= 7
  if (vasche === '2 vasche') {
    if (larghezza <= 10) return fonda ? vasca(400, 500, 250) : vasca(400, 400, 250)
    if (!fonda) return vasca(500, 400, 250)
    return larghezza <= 13 ? vasca(500, 500, 300) : vasca(600, 500, 320)
  }
  if (vasche === 'vasca + gocciolatoio') {
    if (!fonda) return vasca(500, 400, 250)
    return larghezza <= 13 ? vasca(500, 500, 300) : vasca(600, 500, 320)
  }
  if (!fonda) return vasca(500, 400, 250)
  if (larghezza <= 6) return vasca(400, 500, 250)
  return larghezza <= 7 ? vasca(500, 500, 250) : vasca(600, 500, 320)
}

/** The node fields an article code sets: its kind, sizes in metres, and the options. */
export type DaCodice = { kind: string; defaults: Record<string, unknown> }

const TAVOLO_CODICE = /^ETGE\s*(\d{1,2})\s*\/\s*([67])(?:\s*(AR|A|R))?$/i
const LAVELLO_CODICE = /^ELGE\s*(?:(2V|1VGDX)\s*)?(\d{1,2})\s*\/\s*([67])$/i

/**
 * Shape and options for a table (`ETGE 12/7 AR`) or sink (`ELGE 2V 14/7`) code, else null.
 * The size numbers are decimetres: width / depth.
 */
export function daCodice(code: string): DaCodice | null {
  const text = code.trim().replace(/\s+/g, ' ')
  const tavolo = TAVOLO_CODICE.exec(text)
  if (tavolo) {
    const modello = (tavolo[3] ?? '').toUpperCase()
    return {
      kind: TAVOLO,
      defaults: {
        width: Number(tavolo[1]) / 10,
        depth: Number(tavolo[2]) / 10,
        height: ALTEZZA,
        alzatina: modello.includes('A'),
        ripiano: modello.includes('R'),
      },
    }
  }
  const lavello = LAVELLO_CODICE.exec(text)
  if (lavello) {
    const tipo = (lavello[1] ?? '').toUpperCase()
    const vasche: Vasche =
      tipo === '2V' ? '2 vasche' : tipo === '1VGDX' ? 'vasca + gocciolatoio' : '1 vasca'
    const larghezza = Number(lavello[2])
    const profondita = Number(lavello[3])
    const v = vascaPer(vasche, larghezza, profondita)
    return {
      kind: LAVELLO,
      defaults: {
        width: larghezza / 10,
        depth: profondita / 10,
        height: ALTEZZA,
        struttura: 'a giorno',
        vasche,
        alzatina: true,
        vascaLarghezza: v.larghezza,
        vascaProfondita: v.profondita,
        vascaAltezza: v.altezza,
      },
    }
  }
  return null
}

/** A rectangle on the worktop, in the unit's frame: centre and size, metres. */
export type Riquadro = { x: number; z: number; w: number; d: number }

const GOCCIOLATOIO_MIN = 0.25

/** Gap kept between a bowl and the worktop edge, the upstand, or the next bowl. */
const BORDO = 0.05

/**
 * Where the bowls (and the drainer) sit on a sink W × D: centred in depth, each bowl in its half
 * for two, the bowl on the left and the drainer on the right otherwise. A bowl too big for the top
 * is shrunk to fit.
 */
export function pianoLavello(
  W: number,
  D: number,
  vasche: Vasche,
  bowl: { w: number; d: number },
): { bowls: Riquadro[]; drainer: Riquadro | null } {
  const d = Math.min(bowl.d, D - 2 * BORDO)
  if (vasche === '2 vasche') {
    const w = Math.min(bowl.w, W / 2 - 1.5 * BORDO)
    return {
      bowls: [
        { x: -W / 4, z: 0, w, d },
        { x: W / 4, z: 0, w, d },
      ],
      drainer: null,
    }
  }
  if (vasche === 'vasca + gocciolatoio') {
    const left = -W / 2 + BORDO + 0.03
    // The drainer keeps at least this much; the bowl gives way first.
    const w = Math.min(bowl.w, W - 2 * BORDO - 0.03 - BORDO - GOCCIOLATOIO_MIN)
    const drainerStart = left + w + BORDO
    const drainerW = W / 2 - BORDO - drainerStart
    return {
      bowls: [{ x: left + w / 2, z: 0, w, d }],
      drainer: drainerW > 0.05 ? { x: drainerStart + drainerW / 2, z: 0, w: drainerW, d } : null,
    }
  }
  return { bowls: [{ x: 0, z: 0, w: Math.min(bowl.w, W - 2 * BORDO), d }], drainer: null }
}
