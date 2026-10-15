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

### Stato fase 0 (2026-10-15, branch `fase-0-licenze`)

Fatto:
- 0.1–0.3: tolti i 7 plugin, `@react-three/xr`, `agentation`, `blob-stream`/`blob` (export PDF con `Blob` nativo). `bun.lock` non li contiene più.
- 0.4: catalogo vuoto; 80 materiali convertiti in tinta unita (stessi id, colori scelti a mano); suoni disattivati (`setSFXEnabled`, spento di default); `ASSETS_CDN_URL` vuoto = asset serviti dall'app stessa; esempi IFC senza indirizzo Supabase; i test IFC che leggono i file rimossi sono saltati con `skipIf` (tornano attivi se si aggiungono file con licenza); loghi e favicon sostituiti dal logo del progetto (`ProductMark`, `app/icon.svg`); README riscritto.
- 0.5: tolti manifest e skill del plugin per agenti di Pascal, i workflow `release.yml` e `mcp-registry.yml`, la validazione `skills:validate`; testi "Pascal" dell'interfaccia resi neutri.
- `ASSETS.md`: registrati font, fixture, icone e favicon (icone e favicon: **da sostituire**).

Verifica: `bun run ci` passa. Nel codice inviato al browser non restano indirizzi `editor.pascal.app` né `supabase.co`. Controllo nel browser fatto dall'utente il 2026-10-15 (strumenti di rete di Chrome, filtri `pascal` e `supabase`): nessuna richiesta.

Resta aperto:
- Icone dell'interfaccia (91) di origine non documentata.
- Catalogo di prova del server MCP (`packages/mcp/src/tools/asset-catalog.ts`): nomi e misure senza file, punta a `/items/...` ora vuota.
- CLI `packages/cli` (`agent-account.ts`): il comando di collegamento account contatta `editor.pascal.app` se usato.
- Testi OFL dei font da copiare in `THIRD_PARTY_NOTICES.md`.

## Fase 1: prototipo della distinta

- Definire uno schema Zod `ProductRef` (codice articolo, descrizione, unità, prezzo di listino, fornitore, categoria) e salvarlo in `node.metadata`. Validarlo quando si legge.
- Creare un plugin `horeca` (nuovo pacchetto) che registra le `NodeDefinition` Ho.Re.Ca, partendo dal modo in cui `packages/nodes` definisce i suoi. Per i primi tre elementi (banco frigo, cella modulare, lavello inox) usare geometria parametrica da codice, senza modelli.
- Implementare `schedule` per quei nodi: colonne codice, descrizione, quantità, prezzo, totale. Il PDF a fogli (`sheet-export.ts`) già stampa le schedule.
- Esportare la distinta in CSV e JSON dallo stato della scena.

**Verifica:** test unitari su una scena con elementi noti (quantità e totali esatti); il PDF contiene la tabella.

### Stato fase 1 (2026-10-15, branch `fase-0-licenze`)

Cambiato rispetto al piano: niente prezzi nel CAD, perché il contratto scelto con il CRM (`invia_distinta`, vedi `CLAUDE.md`) li lascia al Preventivatore del CRM. La distinta ha codice, articolo e quantità.

Fatto, nel pacchetto `packages/horeca` (`@3dcad-horeca/horeca`):
- `product.ts`: articolo in `metadata.product` = `{ item_id, code, name }`, validato con Zod alla lettura (id non uuid = "non valido", contato a parte).
- `distinta.ts`: conteggio, impronta SHA-256 identica al CAD in Rust (stesso valore di test), payload `invia_distinta` con i limiti del CRM, CSV per Excel italiano.
- Tre nodi parametrici (banco frigo, cella frigo, lavello inox) con geometria da codice, ingombro in pianta, strumento di piazzamento, campi articolo nell'inspector.
- Tabelle nel PDF (una per tipo di attrezzatura) tramite `schedule`.
- Pannello laterale "Ho.Re.Ca": pulsanti per piazzare, distinta, download CSV e JSON (il JSON avrà gli id di disegno, cliente e trattativa con la fase 4).

Verifica: 19 test del pacchetto, `bun run ci` passa. Prova a mano nell'editor fatta dall'utente il 2026-10-15: piazzamento, articolo, distinta, CSV e tabella nel PDF funzionano.

Nota: se `bun dev` dà errori `EMFILE: too many open files`, avviare solo l'app con `bun run --cwd apps/editor dev` (i pacchetti vanno prima compilati con `bun run build`).

Punti aperti emersi:
- Le icone `iconify` dell'editor vengono scaricate a runtime da `api.iconify.design`: per l'uso offline vanno incluse nel pacchetto.

## Fase 2: catalogo Ho.Re.Ca

Rivista il 2026-10-15 con l'utente. Il catalogo vero sta nel CRM (`catalog_items`, misure in mm, nessun modello 3D per ora); le forme sono parametriche da codice, non GLB. Il catalogo "padrone" è quello dell'app Preventivatore (`app_id` obbligatorio): il CAD lo legge, non lo scrive. L'import di un listino nel catalogo vero va fatto nel Preventivatore o nel CRM (lavoro separato in quei progetti).

### 2a. Catalogo da file (fatto, provato dall'utente il 2026-10-15)
- `catalog.ts`: lettura CSV (`;` o `,`, intestazioni in italiano o inglese, decimali con la virgola) e JSON (elenco o `{ items }`), errori per riga.
- `catalog-store.ts`: catalogo e associazione categoria → forma salvati nel browser (localStorage); un nuovo file sostituisce gli articoli da file, non quelli dal CRM.
- Articoli senza ID CRM ("non nel CRM"): disegnati, nel CSV e nel PDF, mai nel JSON per il CRM.
- Nuova forma "Attrezzatura generica" (blocco con le misure, codice scritto in pianta) per le categorie senza forma.
- Pannello: importa file, cerca e inserisci articolo (misure e dati già compilati), forma per categoria. Inspector: "Forma" cambia la forma di un elemento già piazzato in un solo passo annullabile.
- File di prova: `docs/progetto/esempio-catalogo.csv` (attrezzature di un laboratorio di gelateria, codici inventati).

### 2b. Catalogo dal CRM (fatto, da provare con un utente vero)
- `crm.ts`: login Supabase (email e password, la password non si salva), rinnovo della sessione, lettura di `catalog_items` a pagine da 1000 con i nomi da `catalog_categories`; dalla seconda volta solo le modifiche (`updated_at`) e le cancellazioni (`deleted_rows`); articoli disattivati tolti. Stesse richieste del CAD in Rust.
- Gli articoli del CRM entrano nello stesso catalogo locale (sorgente `crm`); quelli da file restano.
- Configurazione in `.env.local` (esclusa da git): `NEXT_PUBLIC_CRM_SUPABASE_URL`, `NEXT_PUBLIC_CRM_SUPABASE_KEY` (chiave publishable). Verificato senza credenziali: il CRM risponde, accetta richieste dal browser e senza login non mostra il catalogo (RLS).
- Pannello: sezione CRM con accesso, "Aggiorna catalogo dal CRM" ed esci.

### 2c. Forme nuove (da fare, ordine proposto dal render di riferimento)
1. Tavolo su gambe (con o senza ripiano). 2. Pensile ante scorrevoli, anche con gocciolatoio (appeso: serve "altezza da terra"). 3. Lava-mani a parete. 4. Lavastoviglie e abbattitore. 5. Mantecatore e pastorizzatore. 6. Frigorifero verticale. 7. Tramoggia su ruote.
Inoltre, emersi dal render: rivestimento pareti in piastrelle (servono texture CC0), etichette con il nome delle attrezzature nel 3D.

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
