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

## Aggiunte da questo progetto

Licenze lette nel file LICENSE di ciascun pacchetto. Serve solo conservare la nota di copyright MIT, che è dentro i pacchetti stessi.

| Componente | Licenza | Copyright | Usato per |
|---|---|---|---|
| `dxf` 5.3.1 (dipendenze `lodash`, `vecks`, `commander`: MIT) | MIT | © 2014-2018 Ben Nortier | Lettura del rilievo DXF (fase 3) |
| `@tarikjabiri/dxf` 2.9.0 | MIT | © 2021-present EL JABIRI Tarik | Scrittura DXF (esempio di rilievo, export della fase 3b) |
| `three-gpu-pathtracer` 0.0.27 (solo `three-gpu-pathtracer/webgpu`) e `three-mesh-bvh` 0.9.16 (già presente in upstream, aggiornato da 0.9.10) | MIT | © 2021 Garrett Johnson; © 2018 Garrett Johnson | Render fotorealistico (fase 5b) |
| `@react-three/drei` (già presente in upstream) | MIT | © 2020 react-spring | Etichette 3D delle attrezzature (fase 2e) |
| `electron` 44.7.2 | MIT | © Electron contributors, © 2013-2020 GitHub Inc. | App desktop (fase 6). Include Chromium e Node.js: le loro licenze viaggiano nell'app (`LICENSE` e `LICENSES.chromium.html`, aggiunti da Electron stesso) |
| Icone Iconify (52, copiate in `packages/editor/src/lib/offline-icons/icons.json` da `@iconify-json/*`, solo per generarle): Lucide (ISC, © Lucide Contributors), Material Design Icons (Apache-2.0, © Pictogrammers), Phosphor (MIT, © Phosphor Icons), Carbon (Apache-2.0, © IBM), Charm (MIT, © Jay Newey), IconPark Outline (Apache-2.0, © ByteDance), Qlementine (MIT, © Olivier Cléro), Vaadin (Apache-2.0, © Vaadin) | ISC, MIT, Apache-2.0 | Vedi colonna a sinistra | Icone dell'editor anche senza internet (fase 6b); prima l'editor le scaricava da api.iconify.design. ISC equivale alla MIT. Per le Apache-2.0 il testo della licenza va distribuito con l'app (fase 7) |
| Decodificatori Draco (© Google), Basis Universal (© Binomial LLC), manifold-3d 3.5.4 (© Emmett Lalish e contributori), in `apps/editor/public/decoders` | Apache-2.0 | Vedi colonna a sinistra | Modelli compressi, texture KTX2 ed export di stampa 3D senza internet (fase 6b). Testo della licenza Apache da distribuire con l'app (fase 7) |
| `electron-updater` 6.8.9, con le sue dipendenze `builder-util-runtime`, `fs-extra`, `js-yaml`, `semver`, `lazy-val`, `lodash.isequal`, `lodash.escaperegexp`, `tiny-typed-emitter`, `debug`, `ms`, `graceful-fs`, `jsonfile`, `universalify`, `argparse`, `sax` (incluse nel file principale dell'app desktop) | MIT; `semver` e `graceful-fs` ISC; `argparse` Python-2.0; `sax` Blue Oak 1.0.0 | © 2015 Loopline Systems e gli autori di ciascun pacchetto | Aggiornamenti automatici dell'app desktop da GitHub Releases (fase 6d). ISC, Python-2.0 e Blue Oak sono licenze permissive come la MIT |
| `electron-builder` 26.15.3 (solo per creare gli installatori, non è dentro l'app) | MIT | © 2015 Loopline Systems | Installatori dmg / exe / AppImage (fase 6) |

## Eliminate nella fase 0

Non fanno più parte del progetto (né di `package.json` né di `bun.lock`): `agentation` (PolyForm Shield 1.0.0, non open source), `blob-stream` e `blob` (senza licenza; l'export PDF ora usa il `Blob` nativo), i 7 plugin di terzi e `@react-three/xr`.
