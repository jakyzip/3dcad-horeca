# Avvisi di terze parti

BOZZA da completare. Va aggiornata a ogni nuova dipendenza o asset. Per gli asset vedi `ASSETS.md`.

## Codice di partenza

Questo progetto è un fork di `pascalorg/editor` (https://github.com/pascalorg/editor, commit `6343c62`), distribuito con licenza MIT.

> MIT License
> Copyright (c) 2026 Pascal Group Inc.
>
> (testo completo della licenza nel file `LICENSE`, da conservare in ogni copia del codice originale)

## Dipendenze con obblighi particolari

Stato rilevato sul `bun.lock` di upstream; da riverificare dopo aver rigenerato il lockfile.

| Componente | Licenza | Cosa serve | Stato |
|---|---|---|---|
| `web-ifc` | MPL-2.0 | Se si modificano i suoi file, restituirli sotto MPL-2.0; indicare dove trovare il codice | Da completare con il testo e l'indirizzo del progetto |
| `manifold-3d` | Apache-2.0 | Conservare il testo della licenza e le note NOTICE | Da completare |
| Font Geist e Geist Mono (`geist`) | SIL OFL 1.1 | Includere il testo OFL e il copyright dal pacchetto `geist` | Da completare |
| Font Plus Jakarta Sans | SIL OFL (da verificare nel file) | Includere testo OFL e copyright dal file del font | Da verificare |
| Font Liberation Sans e Geist Mono nei PDF (`packages/editor/src/lib/floorplan/pdf-fonts/`) | SIL OFL (da verificare nei file) | Includere testo OFL e copyright | Da verificare |
| `@fortawesome/free-solid-svg-icons` | CC-BY-4.0 (icone), MIT (codice) | Attribuzione, se le icone sono ancora presenti | Da verificare se ancora usato |
| `caniuse-lite` | CC-BY-4.0 | Attribuzione (dati usati in fase di build) | Da completare |
| `@img/sharp-*` e librerie `libvips` | LGPL-3.0, Apache-2.0 | Solo se si distribuiscono binari: testo della licenza e codice | Da verificare se serve |
| `lightningcss` | MPL-2.0 | Strumento di build, non incluso nell'app | Nessuna azione prevista |

## Da eliminare

Dipendenze che il piano toglie e che non devono comparire nei rilasci: `agentation` (PolyForm Shield 1.0.0, non open source), `blob` (senza licenza), i 7 plugin di terzi (`PIANO.md`, fase 0).
