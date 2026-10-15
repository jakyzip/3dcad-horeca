# Verifica licenze del fork di Pascal Editor

Repository analizzato: `pascalorg/editor`, commit `6343c62` (15 ottobre 2026), clone superficiale (senza storico).
Questa è una verifica tecnica, non un parere legale.

## Sintesi

| Area | Esito | Azione |
|---|---|---|
| Codice del repository (9 pacchetti) | MIT, tutto | Nessuna: tenere `LICENSE` e la nota di copyright |
| Plugin di terzi (7) | Codice MIT, ma con immagini/texture di origine non documentata | Rimuoverli dal fork (sono per esterni, piscine, XR) |
| Dipendenze (957 pacchetti npm) | 904 permissive; 4 punti da risolvere | Vedi sezione 3 |
| Modelli 3D (145 GLB) | Nessuna licenza né attribuzione | Non ridistribuirli finché non sono chiariti |
| Texture (68 materiali), audio (28), HDRI, icone | Nessuna licenza documentata | Sostituire o verificare |
| Marchio e logo "Pascal" | Non coperti dalla MIT | Rimuovere e rinominare |

## 1. Plugin di terzi (7)

Scaricati al commit bloccato in `apps/editor/package.json` e letti uno per uno.

| Plugin | Licenza | Copyright | File binari inclusi | Serve per Ho.Re.Ca? |
|---|---|---|---|---|
| `@mint/pascal-plugin` | MIT | Mint | 2 immagini | No |
| `plugin-bones` | MIT | Julien Brissonneau | 3 immagini | No |
| `plugin-environment` | MIT | Pascal | 125 (12 texture PBR di terreno/strade) | No |
| `plugin-pool` | MIT | Pascal | 35 miniature | No |
| `plugin-streetscape` | MIT | Pascal | 42 miniature | No |
| `plugin-trees` | MIT | Pascal | 13 immagini | No |
| `@webxr/plugin` | MIT | WebXR contributors | 0 | No |

Dipendenze proprie dei plugin: `@dgreenheck/ez-tree`, `iwer`, `@iwer/devui`, `three-bvh-csg`, `three-mesh-bvh`, `react-colorful`, `@radix-ui/react-tooltip` sono MIT; `lucide-react` è ISC; `@react-three/xr` e `@pmndrs/xr` dichiarano "SEE LICENSE IN LICENSE", e il file letto è MIT.

Punto aperto: il codice è MIT, ma le immagini e le texture dentro i plugin non hanno indicata l'origine. In `plugin-environment` il file `lab/public/icons/fittings/README.md` dice che alcune icone sono state generate con uno strumento di immagini AI.

## 2. Pacchetti del repository

Tutti MIT, versione 1.0.4: `core`, `viewer`, `editor`, `nodes`, `mcp`, `cli`, `ifc-converter`, `geometry-script`, `ui`.
Copyright: "Pascal Group Inc." (2026). Va conservato.

## 3. Dipendenze

Interrogato il registro npm per ognuna delle 957 voci del lockfile.

- 904 permissive (735 MIT, 103 Apache-2.0, 29 ISC, BSD, ecc.).
- **`agentation` 3.1.2: PolyForm Shield 1.0.0.** Non è una licenza open source: vieta di usare il software per offrire un prodotto concorrente. È usata solo in `apps/editor/app/layout.tsx`. Da togliere.
- **`blob` 0.0.4: nessuna licenza** (né campo né file). Probabile dipendenza di `blob-stream`, usato per l'export PDF in `packages/editor`; da confermare. Soluzione: usare il `Blob` nativo del browser.
- `png-js`, `webgl-constants`, `@react-grab/cli`: nel registro risultano senza licenza, ma il file LICENSE nel pacchetto è MIT. Nessun problema.
- **`web-ifc` 0.0.78: MPL-2.0.** Usato a runtime per l'IFC. Ammesso: obbliga solo a restituire sotto MPL le modifiche ai suoi file.
- `lightningcss` (MPL-2.0): strumento di build del CSS, non finisce nell'app.
- `@img/sharp-*` (LGPL-3.0 e Apache-2.0): librerie native di `sharp`, probabile dipendenza di Next.js per le immagini; da confermare. Pesano solo se distribuisci binari.
- `@fortawesome/free-solid-svg-icons` e `caniuse-lite`: CC-BY-4.0, richiedono attribuzione.
- `geist` e Plus Jakarta Sans: font SIL OFL, richiedono di includere il testo della licenza.
- `manifold-3d`: Apache-2.0, conservare le note.

## 4. Asset (dettaglio in `inventario-asset.csv`)

| Tipo | Quantità | Stato |
|---|---|---|
| Modelli 3D `.glb` | 145 | Nessun campo `copyright` né `extras` nei file |
| Texture PBR | 68 materiali (18 MB totali, formati webp, jpg e ktx2) | Origine non documentata |
| Audio `.mp3` | 27 (+1 `.mamd`) | Origine non documentata |
| HDRI | 1 (`venice_sunset_1k.hdr`) | Nome coerente con un HDRI di Poly Haven (CC0), non confermato |
| Font | 4 | OFL, ok con avviso |
| Icone | molte | Alcune generate con strumento AI |

Sui modelli: 84 sono passati da un ottimizzatore (glTF-Transform), 50 da Blender, 7 da `obj2gltf` e 4 da `FBX2glTF`. Quelli convertiti da OBJ/FBX hanno nomi di nodi tipici di modelli scaricati (per esempio `kitchenFridge`, `MarbleSinkKitchenCabinet1`, `group1257628551`). È un indizio, non una prova di provenienza esterna.

In più, 111 voci del catalogo (`catalog-items.tsx`) puntano a file su uno storage Supabase di Pascal, che da questa sessione non ho potuto raggiungere.

## 5. Cosa fare, in ordine

1. Fork: copiare `LICENSE` e aggiungere la propria riga di copyright.
2. Rimuovere i 7 plugin e `agentation` da `apps/editor`.
3. Sostituire `blob-stream`/`blob` con il `Blob` nativo.
4. Rimuovere nome e logo "Pascal" (`apps/editor/public/pascal*.svg`, `assets/pascal-mark*`) e rinominare.
5. Svuotare `public/items`, `public/material`, `public/audios` e le icone, tenendo solo ciò che ha una licenza documentata. I nodi parametrici (armadi, HVAC, tubi, canali) sono definiti da schemi nel codice: non ho verificato ogni renderer, ma non dovrebbero dipendere dai GLB.
6. Ricostruire il catalogo con fonti a licenza chiara (per esempio CC0: Poly Haven, ambientCG, Quaternius, Kenney), verificando caso per caso e registrando la fonte di ogni file.
7. Creare `THIRD_PARTY_NOTICES.md` con: testo OFL dei font, nota MPL-2.0 di `web-ifc`, note Apache-2.0, attribuzioni CC-BY.
8. Se si vogliono tenere i modelli di Pascal: chiedere conferma scritta a Pascal Group (issue o Discord del progetto).

## 6. Limiti della verifica

- Per le dipendenze ho usato il campo licenza del registro npm, non ho letto il testo di tutti i 957 pacchetti.
- Clone superficiale: non vedo lo storico, quindi non posso risalire a chi ha aggiunto i modelli.
- Non ho aperto i modelli in un visualizzatore né cercato le texture su siti di asset.
- Fuori dalla rete consentita di questa sessione: Supabase e siti di asset.

## 7. Altri file trovati preparando il fork

Non erano nell'inventario iniziale e `setup.sh` li toglie dal primo commit:
- `apps/ifc-converter/public/test-ifc-files/*.ifc` (circa 8 MB): modelli IFC d'esempio di origine e licenza non documentate; usati da tre test di `packages/ifc-converter`.
- `apps/editor/vendor/pascal-app-plugin-pool-0.1.0-dist6.tgz` (3 MB): archivio del plugin piscina.
- `docs/media/next-demo/*.gif`: GIF dimostrative di Pascal Next, rilasciate da Pascal sotto CC BY 4.0, non parte dell'editor open source.
- `skills/.cursor-plugin/pascal-mark-plate.svg` e altri `pascal-mark*`: logo.
- `apps/editor/public/demos/demo_1.json`: scena demo che usa i modelli rimossi (non referenziata dal codice).
- Boilerplate di Next, Vercel e Turborepo in `apps/editor/public/`, non referenziato dal codice.

Restano, da documentare: l'icona `apps/editor/app/favicon.ico`, le 77 icone `apps/editor/public/icons/*.webp` (alcune generate con strumenti AI), `docs/images/curtain-wall-variations.png`, la fixture `packages/geometry-script/src/__fixtures__/blender/cabinet.glb`, le tre piccole fixture IFC di `packages/ifc-converter/tests/fixtures/` (3-4 KB l'una, l'intestazione dei file indica "Pascal" come autore: coperte dalla MIT) e i font in `packages/editor/src/lib/floorplan/pdf-fonts/` (Liberation Sans e Geist Mono).
