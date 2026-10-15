# Piano di lavoro

Base: `pascalorg/editor` commit `6343c62`. Le righe e i percorsi qui sotto sono quelli di quel commit.
Ogni fase ha un criterio di verifica: non passare alla successiva se non è soddisfatto.

## Fase 0: pulizia delle licenze (blocca tutto il resto)

Lo script `setup.sh` ha già tolto dal primo commit: modelli 3D, texture, suoni, HDRI, scena demo, loghi "Pascal", GIF dimostrative (`docs/media`), l'archivio del plugin piscina (`apps/editor/vendor`) e i file IFC d'esempio (`apps/ifc-converter/public/test-ifc-files`). Il resto va fatto a mano:

**0.1 Rimuovere i 7 plugin di terzi** (tutti per esterni, piscine, strade, realtà virtuale; non servono a Ho.Re.Ca):
- `apps/editor/package.json`: dipendenze `@mint/pascal-plugin`, `@pascal-app/plugin-bones`, `plugin-environment`, `plugin-pool`, `plugin-streetscape`, `plugin-trees`, `@webxr/plugin` e, se non resta altro che le usa, `@react-three/xr`.
- `apps/editor/next.config.ts` righe 46-52 (`transpilePackages`).
- `apps/editor/lib/bootstrap.ts` righe 1-22 (import) e il punto dove i plugin vengono registrati.
- Eliminare `apps/editor/app/api/plugins/mint/[...path]/route.ts`, `components/webxr-wand-bindings.ts`, `components/webxr-feature-gate.tsx`.
- `apps/editor/components/scene-loader.tsx` (usa `PascalWebXRButton`), `apps/editor/lib/build-panel-model.ts` (tipi XR), `apps/editor/lib/scene-signature.test.ts` (aggiornare).
- Citazioni nei testi: `README.md`, `CONTRIBUTING.md`, `packages/cli/README.md`.

**0.2 Rimuovere `agentation`** (licenza PolyForm Shield, non open source): `apps/editor/app/layout.tsx` riga 1 e `apps/editor/package.json`. Opzionale: `react-grab` (MIT, strumento di sviluppo), in `package.json` radice e `apps/editor`.

**0.3 Sostituire `blob-stream`** (usa il pacchetto `blob`, senza licenza): `packages/editor/src/lib/floorplan/floorplan-pdfkit-document.ts` riga 475 (import dinamico). Raccogliere i pezzi dello stream di PDFKit e costruire un `Blob` nativo. Togliere la dipendenza da `packages/editor/package.json`.

**0.4 Togliere i riferimenti agli asset rimossi:**
- `packages/editor/src/components/ui/item-catalog/catalog-items.tsx`: 111 voci che puntano al Supabase di Pascal. Svuotare `CATALOG_ITEMS`.
- `packages/core/src/material-library.ts`: 67 materiali che puntano a `/material/...`. Sostituire con texture CC0 registrate in `ASSETS.md`, oppure ridurre a colori in tinta unita.
- `packages/editor/src/lib/sfx-player.ts`: 24 suoni. Disattivare i suoni o sostituirli con suoni CC0.
- `packages/viewer/src/lib/asset-url.ts` riga 3: il valore predefinito di `ASSETS_CDN_URL` è `https://editor.pascal.app`, cioè l'app scarica gli asset dal sito di Pascal. Impostare una stringa vuota (asset locali) o un proprio indirizzo.
- `apps/ifc-converter/lib/test-files.ts`: scarica file IFC di esempio da Supabase, con licenza ignota. Togliere o sostituire.
- I file IFC d'esempio rimossi servono a questi test: `packages/ifc-converter/tests/openings.test.ts`, `export-roundtrip.test.ts`, `room-first-load.test.ts`. Finché non ci sono IFC propri (o con licenza chiara) quei test falliscono: saltarli esplicitamente e annotare il motivo, senza cancellarli.
- `packages/geometry-script/src/__fixtures__/blender/cabinet.glb`: unico modello rimasto, è una fixture di test. Documentarlo in `ASSETS.md` oppure rigenerarlo.
- `README.md` rimanda alle GIF di `docs/media` (rimosse): riscrivere il README (fase 7) o togliere quella sezione.
- L'HDRI `venice_sunset_1k.hdr` non serve: `packages/viewer/src/components/viewer/scene-environment.tsx` usa già un cielo procedurale.
- Loghi: `apps/editor/components/app-shell.tsx` righe 30 e 42, `apps/editor/components/embed-viewer.tsx` riga 143. Mettere un logo proprio.

**0.5 Materiale di marca e servizi di Pascal:**
- Rivedere o togliere `.claude-plugin`, `.codex-plugin`, `.cursor-plugin`, `gemini-extension.json`, `mcp.json`, `plugin.json`, `server.json`: puntano al server ospitato `editor.pascal.app`.
- Rivedere `.github/workflows` (pubblicazione su npm, deploy): usano segreti e account di Pascal. Disattivare ciò che non ci riguarda.
- Cartella `skills/`: sono competenze per agenti basate sull'MCP di Pascal. Tenerle solo se si adattano e si rinominano.
- Nome visibile del prodotto: sostituire "Pascal" nei testi dell'interfaccia. Il cambio dello scope npm interno `@pascal-app/*` si può rimandare a quando si pubblica su npm: è meccanico ma tocca ogni `package.json` e ogni import.
- `LICENSE`: lasciare la riga di Pascal Group Inc. e aggiungere sotto la riga del nuovo titolare (da decidere con l'utente).

**Verifica fase 0:** `bun install` e `bun run ci` passano; `bun dev` apre l'editor; negli strumenti di rete del browser non compaiono richieste a `editor.pascal.app` né a `supabase.co`; nel repository non resta nessun `.glb`, texture o `.mp3` senza riga in `ASSETS.md`.

## Fase 1: prototipo della distinta

- Definire uno schema Zod `ProductRef` (codice articolo, descrizione, unità, prezzo di listino, fornitore, categoria) e salvarlo in `node.metadata`. Validarlo quando si legge.
- Creare un plugin `horeca` (nuovo pacchetto) che registra le `NodeDefinition` Ho.Re.Ca, partendo dal modo in cui `packages/nodes` definisce i suoi. Per i primi tre elementi (banco frigo, cella modulare, lavello inox) usare geometria parametrica da codice, senza modelli.
- Implementare `schedule` per quei nodi: colonne codice, descrizione, quantità, prezzo, totale. Il PDF a fogli (`sheet-export.ts`) già stampa le schedule.
- Esportare la distinta in CSV e JSON dallo stato della scena.

**Verifica:** test unitari su una scena con elementi noti (quantità e totali esatti); il PDF contiene la tabella.

## Fase 2: catalogo Ho.Re.Ca

Modelli GLB da fonti CC0 o proprie, ognuno con riga in `ASSETS.md`. Per ogni elemento: dimensioni reali, ingombro 2D, codice articolo. Nome dei file e tag coerenti con `AssetInput` (`packages/core/src/schema/nodes/item.ts`).

## Fase 3: rilievo e DXF

Importare un DXF come riferimento 2D (esiste il nodo `guide` per le immagini da ricalcare) ed esportare la pianta in DXF. Nessuna delle due cose è nel codice oggi. Scegliere la libreria dopo aver controllato la licenza.

## Fase 4: collegamento al CRM

Due strade già presenti: le API `apps/editor/app/api/scenes` e il server MCP (`packages/mcp`, salvataggio SQLite). Definire con l'utente il formato (JSON con righe distinta, cliente, totale) e un endpoint che il CRM può chiamare.

## Fase 5: render

Rendering di qualità media dentro il viewer, con esportazione PNG. Candidato: `three-gpu-pathtracer` (verificarne licenza e compatibilità con la versione di Three.js in uso).

## Fase 6: desktop

Confrontare Tauri (servirebbe un processo Node o Bun incluso per API e SQLite) con l'installazione web self-hosted (`bun` o Docker, già previsti dal repository). Decidere con l'utente.

## Fase 7: rilascio

`README` nuovo, `THIRD_PARTY_NOTICES.md` completo, `LICENSE`, nome e logo, CI. Controllare un'ultima volta `ASSETS.md` e le licenze di tutte le dipendenze.

## Rischi da tenere d'occhio

- Il commit di partenza è un'istantanea: gli aggiornamenti di Pascal non si fondono da soli. Se si vuole seguirli, tenere il remote `upstream` e unire a mano, ma solo codice (mai asset).
- Il `bun.lock` è di upstream: dopo aver tolto i plugin va rigenerato (`bun install`) e riverificate le licenze nuove.
- Non ho eseguito l'app né i test del repository: tutto ciò che è scritto qui deriva dalla lettura del codice.
