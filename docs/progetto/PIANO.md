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

### 2b. Catalogo dal CRM (fatto e provato)
- `crm.ts`: login Supabase (email e password, la password non si salva), rinnovo della sessione, lettura di `catalog_items` a pagine da 1000 con i nomi da `catalog_categories`; dalla seconda volta solo le modifiche (`updated_at`) e le cancellazioni (`deleted_rows`); articoli disattivati tolti. Stesse richieste del CAD in Rust.
- Gli articoli del CRM entrano nello stesso catalogo locale (sorgente `crm`); quelli da file restano.
- Configurazione in `.env.local` (esclusa da git): `NEXT_PUBLIC_CRM_SUPABASE_URL`, `NEXT_PUBLIC_CRM_SUPABASE_KEY` (chiave publishable). Verificato senza credenziali: il CRM risponde, accetta richieste dal browser e senza login non mostra il catalogo (RLS).
- Pannello: sezione CRM con accesso, "Aggiorna catalogo dal CRM" ed esci.

### 2c. Forme nuove (fatto, da provare nell'editor)
Dal render di riferimento (laboratorio di gelateria): tavolo su gambe (ripiano sotto facoltativo), pensile ante scorrevoli (anche gocciolatoio, appeso a 1,5 m), lava-mani a parete, lavastoviglie, abbattitore, mantecatore, pastorizzatore, frigorifero verticale, tramoggia su ruote. Totale 13 forme con il blocco generico.
- Campo comune "Altezza da terra" (`elevation`, 0 per gli elementi a terra; le scene salvate prima si caricano uguali). In pianta gli elementi appesi sono tratteggiati; ogni elemento riporta il codice dell'articolo.
- Forma suggerita dal nome: se la categoria non ha una forma scelta a mano, il CAD la deduce dal nome della categoria e poi da quello dell'articolo ("Abbattitore 5 teglie" → abbattitore); altrimenti blocco generico.

### 2d. Piastrelle (fatto, da provare nell'editor)
- Texture generate da script, non scaricate: `packages/horeca/scripts/genera-piastrelle.ts` disegna colore, rilievo (fughe incassate) e anteprima in `apps/editor/public/material/horeca/` per ogni voce di `TILE_SPECS` (`src/tiles.ts`): 10×10 bianca/rosso bordeaux/blu, 20×20 bianca/grigia, 10×20 bianca, pavimento 30×30 chiaro/grigio, 30×60 antracite. Misure reali con gli UV dell'editor (1 unità = 1 m).
- Registrate all'avvio nella libreria materiali (categoria "tile") con `registerLibraryMaterials` in `apps/editor/lib/bootstrap.ts`.
- Rivestimento parziale (es. fino a 150 cm): l'editor lo supporta già con le "regioni" di faccia del muro (`WallFaceRegion`, `v1` = altezza). Da verificare nell'editor come si crea una regione dal pannello Paint.

### 2e. Etichette 3D (fatto, da provare nell'editor)
Sopra ogni attrezzatura, nella vista 3D, compare il nome: quello dell'articolo, altrimenti il nome dato all'oggetto, altrimenti il tipo ("Mantecatore"). Si accendono e spengono dal pannello Ho.Re.Ca ("Mostra i nomi delle attrezzature nel 3D"); la scelta resta salvata nel browser. Le etichette seguono l'oggetto quando lo sposti e spariscono se lo nascondi. Non finiscono negli export GLB/PDF (sono testo della pagina, non geometria). Codice: `packages/horeca/src/labels.ts` e `labels-3d.tsx`.

Stato al 2026-10-15: forme 2c e piastrelle 2d committate (`1a999d5`); etichette 2e committate sul branch `fase-2c-forme`. Fase 3a (import DXF) committata sul branch `fase-3-dxf`; 3b (export DXF) e 3c (muri e quote dal rilievo) committate; fase 4a (invio distinta al CRM) committata; fase 5a (render) committata, da provare nel browser. Fase 6a (app desktop Electron) pronta per il Mac, non committata; installatori Linux e Windows in attesa. Catalogo dal CRM (2b) provato dall'utente con un account vero: funziona. `bun run ci` passa. Prova a mano nell'editor ancora da fare per 2c, 2d e 2e.

## Fase 3: rilievo e DXF

Librerie scelte con l'utente (2026-10-15), entrambe MIT come le loro dipendenze: `dxf` 5.3.1 per leggere, `@tarikjabiri/dxf` 2.9.0 per scrivere.

**DWG**: non si legge direttamente. L'unico lettore libero (LibreDWG, anche nella versione per browser) è GPL-3 e renderebbe GPL tutto il progetto; le alternative (ODA) non sono ridistribuibili. L'utente salva il DWG come DXF da AutoCAD, oppure lo converte con ODA File Converter (gratuito, installato da lui, non incluso nell'app). Se si sceglie un `.dwg`, il pannello lo spiega.

### 3a. Import del rilievo (fatto e provato dall'utente, 2026-10-15)
Pannello Ho.Re.Ca → "Importa rilievo DXF". Il disegno diventa un oggetto "Rilievo DXF" sul piano attivo (`packages/horeca/src/dxf-import.ts`, `rilievo.tsx`):
- linee, polilinee, archi, cerchi, ellissi, spline e blocchi (anche annidati) come linee vettoriali nella pianta, nitide a ogni zoom; nel 3D come linee a terra;
- testi (TEXT e MTEXT, ripuliti dalla formattazione) con altezza e rotazione;
- quote lineari e allineate disegnate con lo stile quote dell'editor e la misura ricalcolata in metri; le altre quote (angoli, raggi) come linee e testi del loro blocco;
- unità di misura letta dal file (`$INSUNITS`), altrimenti dedotta dall'ingombro; si corregge nelle proprietà ("Il disegno è in");
- layer accendibili uno per uno (quelli spenti o congelati nel DXF partono spenti), opacità, rotazione in gradi; si sposta trascinando la cornice tratteggiata;
- resta fuori dalla distinta e dagli export (GLB, PDF).
Esempio per provare: `docs/progetto/esempio-rilievo.dxf` (laboratorio inventato 7 × 5 m, rigenerabile con `bun packages/horeca/scripts/genera-esempio-dxf.ts`).

### 3c. Muri e quote dal rilievo (fatto e provato dall'utente, 2026-10-15)
Nelle proprietà del rilievo, gruppo "Usa il rilievo" (`rilievo-walls.ts`, `rilievo-actions.ts`, `rilievo-tools-field.tsx`); ogni pulsante è un solo passo di annulla:
- **Crea muri dalle linee**: sui layer accesi cerca coppie di linee parallele a 5–60 cm (le due facce di un muro), crea il muro sull'asse con quello spessore, unisce angoli e incroci a T, lascia i vani delle aperture. I lati interno/esterno li classifica poi l'editor, come per i muri disegnati a mano. Limite: le linee dentro un muro sullo stesso layer (vetri delle finestre, davanzali) vengono prese per facce, quindi vanno accesi solo i layer dei muri. Scelto così perché un corridoio stretto tra due muri sottili resti due muri.
- **Trasforma le quote in quote dell'editor**: le quote dei layer accesi diventano quote tecniche dell'editor (`construction-dimension`: stessi punti misurati, stessa linea di quota), modificabili ed esportate in DXF/PDF; il rilievo smette di disegnarle.
Provato senza interfaccia sull'esempio: 5 muri da 30 cm che coincidono col disegno (porta compresa) e 4 quote nelle stesse posizioni.

### 3b. Export della pianta in DXF (fatto e provato dall'utente, 2026-10-15)
Pannello Ho.Re.Ca → "Esporta pianta in DXF": il piano attivo come lo disegna l'editor per i documenti (`collectSheetGeometry`, la stessa raccolta dell'export a fogli), convertito in `packages/horeca/src/dxf-export.ts`:
- millimetri (`$INSUNITS` = mm), un layer per tipo: MURI, APERTURE, SOLAI, AMBIENTI, SCALE, PILASTRI, ARREDI, ATTREZZATURE, QUOTE, TESTI, RILIEVO, ALTRO;
- muri con lo spessore vero, tagliati nei vani di porte e finestre con le spallette; archi e curve spezzati in tratti brevi (`svg-path.ts`);
- quote automatiche dei muri e quote manuali come vere entità DIMENSION, ciascuna con il suo blocco disegnato (`*D1`, `*D2`…), così si vedono anche nei programmi che non ricalcolano le quote; testo della quota uguale a quello dell'editor;
- nome e superficie di ogni ambiente al centro (sui documenti l'editor li lascia all'impaginazione, quindi li scrive l'export);
- attrezzature con il loro codice articolo; il rilievo resta fuori, salvo spuntare "Includi il rilievo nell'export".
Le quote allineate non usano il calcolo dello scostamento di `@tarikjabiri/dxf` 2.9.0 (sbagliato): il punto della linea di quota è passato direttamente.
Provato senza interfaccia su una scena di prova (stanza 6 × 4 m, porta, ambiente, banco frigo): riletto con l'import 3a, misure e posizioni tornano. Non ancora aperto in AutoCAD o LibreCAD.

Limiti noti: niente campiture (i muri sono contorni, non pieni); niente quote del rilievo convertite in quote dell'editor; le scale e gli oggetti di libreria escono come li disegna il foglio, senza blocchi DXF riutilizzabili.

## Fase 4: collegamento al CRM

### 4a. Invio della distinta (fatto, da provare con il CRM vero)
Contratto: `crm_donà/docs/disegni-cad.md` (schema 1), lo stesso del CAD in Rust. Pannello Ho.Re.Ca → "Invia al CRM" (`crm-send.tsx`, `crm.ts`, `crm-link.ts`, `plan-image.ts`):
- serve l'accesso al CRM (sezione CRM in alto);
- **collega il disegno**: cerca il cliente (almeno 2 lettere, `accounts`), scegli una trattativa aperta (`v_deals`, `outcome = open`); cliente, trattativa e `drawing_id` restano nel progetto (metadati del nodo `site`, altrimenti `building`). Stesso cliente → stesso `drawing_id`, quindi reinviare aggiorna lo stesso disegno nel CRM; un cliente diverso → nuovo `drawing_id` (come il CAD in Rust);
- **Invia distinta al CRM**: `rpc('invia_distinta', { p })`, senza prezzi, solo articoli con ID CRM. Se la distinta è cambiata, carica l'immagine della pianta del piano attivo (PNG 2400 × 1600, stessa raccolta dell'export DXF) in `crm-files` al `preview_path` restituito, con `x-upsert`. Un errore sull'immagine non annulla l'invio;
- mostra "Nessuna novità" se il CRM aveva già questa distinta per quella trattativa, e l'elenco degli articoli che il CRM non trova nel catalogo (`non_trovati`).
Provato solo con un server finto nei test (richieste, intestazioni e risposte); l'invio vero scrive nel CRM, quindi va provato dall'utente.

Due copie dello stesso progetto collegate allo stesso cliente hanno lo stesso `drawing_id` e si sovrascrivono nel CRM (come nel CAD in Rust). Per una copia da tenere separata: "Nuovo disegno nel CRM" (con conferma) dà al progetto un nuovo `drawing_id`, stesso cliente e trattativa.

## Fase 5: render

Scelta dell'utente (2026-10-15): prima un render con il motore dell'editor, poi eventualmente il path tracing come modalità "alta qualità".

### 5a. Render con il motore dell'editor (fatto e provato)
Pannello Ho.Re.Ca → "Render": la vista 3D com'è inquadrata, ridisegnata a 1920, 2560 o 3840 px di larghezza (l'altezza segue le proporzioni della vista), senza griglia, guide, zone, scansioni, selezione ed evidenziazione; i nomi delle attrezzature solo se richiesti. Usa la grafica del viewer (WebGPU con luce indiretta SSGI, denoise, ombre, texture): alza per qualche istante il rapporto di pixel, aspetta 40 fotogrammi perché la luce si stabilizzi, legge l'immagine subito dopo un fotogramma (con WebGPU va letta nello stesso istante) e rimette tutto com'era. Codice: `render-store.ts`, `render-system.tsx` (montato come `system` del tipo rilievo, sempre installato con il pacchetto), `render-section.tsx`. Nessuna libreria nuova.
Provato dall'utente il 2026-10-15: l'immagine esce bene ("non male").

Idea rimandata (utente, 2026-10-15: "per ora non serve"): materiali delle attrezzature modificabili con lo strumento Dipingi (parti: struttura, piano, ante/pannelli, guarnizioni) tramite `createSlotPaintCapability`; oggi i materiali sono fissi (inox, inox scuro, bianco, gomma).

### 5b. Path tracing (da decidere dopo la prova di 5a)
`three-gpu-pathtracer` 0.0.27 (MIT, ottobre 2026) funziona solo con `WebGLRenderer` e materiali standard, mentre il viewer usa `WebGPURenderer` con materiali TSL: servirebbe una seconda scena con i materiali convertiti. Immagini più realistiche, ma minuti per immagine.

## Fase 6: desktop

Scelta dell'utente (2026-10-15): **Electron** (niente server: chi usa l'app, per esempio il papà dell'utente, la installa sul proprio computer e lavora offline). Electron porta il suo Chromium, quindi WebGPU va anche su Linux (con gli switch `enable-unsafe-webgpu` e Vulkan). Tauri scartato: su Linux il browser di sistema non ha WebGPU. Licenze: `electron` 44.7.2 e `electron-builder` 26.15.3, MIT (da aggiungere a `THIRD_PARTY_NOTICES.md`).

### 6a. App desktop (fatta per il Mac, non committata)
`apps/desktop`:
- `src/main.ts`: avvia il server dell'editor (build standalone di Next in `runtime/`) con il Node di Electron (`ELECTRON_RUN_AS_NODE=1`) su una porta libera di 127.0.0.1, dati in `userData/data` (`PASCAL_DATA_DIR`), registro in `userData/logs/editor.log`; finestra con schermata "Avvio…", link esterni nel browser, istanza singola, server spento alla chiusura (anche `process.on('exit')` e SIGINT/SIGTERM);
- `scripts/stage.ts`: build `PASCAL_PORTABLE_BUILD=1` dell'editor e preparazione in `build/runtime` con `stageWebRuntime`, estratta dallo script del CLI in `packages/cli/scripts/web-runtime.ts` (lo usa anche `stage-runtime.ts`);
- `electron-builder.yml`: dmg / nsis / AppImage, icona `resources/icon.png` (dal logo). Il runtime si copia da `build` con filtro `runtime/**/*` e `runtime/**/.next/**`: electron-builder scarta sempre un `node_modules` in cima a `from` e le cartelle che iniziano col punto;
- comandi: `bun run start` (prova), `bun run dist:mac|win|linux`.
Verificato: in sviluppo e impacchettata (Mac arm64) l'app avvia il server, apre l'editor, crea un progetto con la scena 3D (WebGPU disponibile); chiudendo la finestra si spegne anche il server. Creati `3DCadHo.Re.Ca-0.1.0-arm64.dmg` (~149 MB) e la versione Intel.
Fatto anche: `executableName: 3dcadhoreca` per Linux (l'AppImage falliva per il nome del pacchetto), note di licenza di Electron in `THIRD_PARTY_NOTICES.md`, icona in `ASSETS.md`; `bun run ci` passa.
**In attesa (scelta dell'utente, 2026-10-15)**: installatori Linux (AppImage) e Windows (nsis), da creare e provare più avanti (anche con la CI della fase 7). Aperti: firma del codice (Apple 99 $/anno, Windows), aggiornamenti automatici.

### 6b. Icone senza internet (fatta)
Le 52 icone Iconify usate dall'editor (8 set, licenze MIT, ISC, Apache-2.0) sono copiate in `packages/editor/src/lib/offline-icons/icons.json` e registrate all'avvio dell'editor: niente più richieste a api.iconify.design. Dopo aver aggiunto un'icona: `bun scripts/offline-icons.ts` in `packages/editor` (il test `offline-icons.test.ts` fallisce finché non lo fai). Corretta anche `lucide:scribble`, che non esiste (icona vuota anche online), con `lucide:line-squiggle`. Anche i decodificatori WebAssembly (Draco per i modelli compressi, Basis per le texture KTX2, manifold per l'export di stampa 3D), prima scaricati da gstatic.com e jsdelivr, ora stanno in `apps/editor/public/decoders` (copiati dai pacchetti con `apps/editor/scripts/copia-decoder.ts`; un test li confronta con i pacchetti). Verificato in Chrome: aprendo un progetto con modelli 3D nessuna richiesta verso host esterni. Da sistemare: le etichette 3D (2e) producono in sviluppo l'avviso React "Attempted to synchronously unmount a root while React was already rendering" (drei `Html`); non blocca nulla.

### 6c. Firma per il Mac (in attesa del certificato)
L'utente è iscritto all'Apple Developer Program, ma nel Portachiavi ci sono solo "Apple Development" e "Apple Distribution": per distribuire il dmg fuori dall'App Store serve "Developer ID Application" (Xcode → Impostazioni → Account → Gestisci certificati), più una password specifica per app per la notarizzazione, che l'utente salva da sé nel Portachiavi (`xcrun notarytool store-credentials`).

### Traduzione in italiano (scelta dell'utente, 2026-10-15: solo italiano, direttamente nel codice)
Blocco 1 (fatto): pagine dell'app, barre, menu, tavolozza dei comandi, suggerimenti a schermo, strumenti, nomi dei tasti; circa 1.100 testi in ~175 file, glossario in `docs/progetto/GLOSSARIO.md`. Nuovi progetti "Progetto #n", nuove zone "Zona n" (i vecchi nomi inglesi continuano a contare). Restano in inglese: pannelli laterali e proprietà (blocco 2), nomi predefiniti e definizioni degli oggetti in `packages/nodes` e `core` (blocco 3), messaggi tecnici della stampa 3D, la tavola americana `lib/floorplan/site-plan` (in piedi e pollici: decidere se serve).
Blocco 2 (fatto): barra laterale, impostazioni, scorciatoie, pannelli delle proprietà, materiali, terreno, temi della vista 3D.
Blocco 3 (fatto): definizioni dei tipi di oggetto (`packages/nodes`) e testi del nucleo (`packages/core`): nomi dei tipi, campi, preset, nomi predefiniti ("Piano terra", "Muro N", "Stanza N", "Porta N"…), messaggi dei comandi, abachi nel PDF, verbi della visita. Dizionario `packages/editor/src/lib/field-labels-it.ts` per le etichette dei campi generate dai nomi interni. I nomi predefiniti inglesi dei progetti vecchi continuano a essere riconosciuti (numerazione, "Ground floor" mostrato come "Piano terra").
Restano in inglese: testi per l'assistente AI (MCP), nomi dei moduli dei mobili che il codice confronta ("Base Cabinet"…), materiali degli strati dei muri (americani), diagnostica della stampa 3D, la tavola `site-plan` americana, alcune quote scritte col punto da `formatConstructionLength` ("Ora 2.45m").
Circa 2.700 testi in inglese nell'editor ereditato. A blocchi con un commit ciascuno: menu e barre, pannelli, proprietà degli oggetti. Le descrizioni per l'assistente AI (MCP) restano in inglese. Più lingue: forse in futuro.

## Fase 8: funzioni per il lavoro tecnico (ordine scelto dall'utente, 2026-10-15: prima il lavoro tecnico, poi disegnare più in fretta, poi chiudere la vendita)

### 8a. Allacciamenti degli impianti (fatto e provato dall'utente, 2026-10-15)
Ogni attrezzatura ha i suoi attacchi in `metadata.allacciamenti` (inseriti nel CAD, salvati sull'attrezzatura): acqua fredda (AF), acqua calda (AC), scarico (S), corrente 230 V e 400 V (con kW), gas (G, con kW); lato (retro, fronte, sinistra, destra), distanza lungo il lato, altezza da terra, "quota in pianta" sì/no. Pulsante "Attacchi tipici" con valori indicativi per tipo di attrezzatura. In pianta: simbolo con la sigla, altezza e quote (una dal muro dietro, una catena lungo il muro dal muro laterale), mostrate con le quote manuali; nel DXF tutto sul livello `IMPIANTI`. Pannello Ho.Re.Ca → "Impianti": attacchi per tipo, potenza elettrica totale (somma, senza contemporaneità), potenza gas, avviso per gli attacchi senza potenza, "Quota tutti" / "Togli le quote". Le quote si ridisegnano quando cambiano i muri del piano (`floorplanDependencies`). Simboli disegnati per il progetto nello stile UNI 9511 / CEI EN 60617, non copiati dalle norme (a pagamento). Codice: `allacciamenti.ts`, `allacciamenti-field.tsx`, `impianti-section.tsx`.
Nota: `floorplanDependsOnSiblings: true` sulle attrezzature bloccava il caricamento di tutti i progetti (ciclo di ricalcolo): non usarlo.

### 8b. Controlli automatici (fatto e provato dall'utente, 2026-10-15)
Avvisi, mai blocchi: attrezzature che si sovrappongono (solo se si sovrappongono anche in altezza: un pensile sopra un tavolo va bene), attrezzature che entrano in un muro, passaggi davanti a un'attrezzatura più stretti del minimo. Minimi scelti dall'utente (2026-10-15): 90 cm per il passaggio, 120 cm per la zona di lavoro (due attrezzature affacciate), modificabili nel pannello e salvati nel progetto (`metadata.controlli` del lotto, come il collegamento al CRM). Le attrezzature a parete sopra 1,20 m non restringono i passaggi. In pianta: bordo rosso e striscia rossa con la larghezza misurata; nel pannello Ho.Re.Ca → "Controlli": elenco cliccabile; mentre si trascina o si seleziona, la riga "!" dell'editor (`placementNotice`). Codice: `controlli.ts`, `controlli-section.tsx`.

### 8c. Composizioni salvate (fatto, da provare nell'editor)
Pannello Ho.Re.Ca → "Composizioni": selezionate alcune attrezzature (Maiusc + clic), "Salva" con un nome; "Inserisci" la ricrea al centro della stanza del piano (centro dei muri), già selezionata da spostare, in un solo passo di annulla. Porta con sé misure, opzioni, articolo e allacciamenti, posizioni relative e rotazioni. Salvate su questo computer (memoria del browser, come il catalogo); "Esporta" / "Importa" un file `composizioni.json` per passarle a un altro computer. Codice: `composizioni.ts`, `composizioni-store.ts`, `composizioni-section.tsx`.
App desktop: porta fissa 39203 (un'altra solo se occupata), perché la memoria del browser dipende dall'indirizzo con la porta e con una porta nuova a ogni avvio catalogo, composizioni ed etichette si perdevano.

### 8d. Progetti modello (fatto, da provare)
Un modello è un progetto il cui nome comincia per "Modello" (es. "Modello – Laboratorio gelateria"): si modifica come gli altri, sta nella sezione "Modelli" della pagina iniziale. Menu della scheda: "Usa come modello" / "Togli dai modelli" (rinomina), e sui modelli "Nuovo progetto da questo modello" (anche come pulsante sotto la scheda): crea "Progetto #n" con una copia completa, senza il collegamento al CRM, e lo apre. Codice: `apps/editor/lib/templates.ts`, `scene-card.tsx`, `app/page.tsx`.

### 8e. Banconi e vetrine componibili (da decidere con l'utente)
Servono i moduli usati davvero (tipi, larghezze standard, angoli).

## Fase 9: chiudere la vendita

### 9a. Tavola PDF per il cliente (fatta, da provare)
Pannello Ho.Re.Ca → "Tavola per il cliente": cliente (dal CRM se collegato, modificabile, salvato nel progetto), formato A3 (un foglio: pianta a sinistra, render, attrezzature e impianti a destra) o A4 (pagine: pianta, vista 3D, attrezzature che continuano su più pagine, impianti), revisione (salvata nel progetto), render sì/no (la vista 3D com'è inquadrata; se non risponde in 30 s il PDF esce senza). Pianta vettoriale con le quote automatiche, alla scala usuale più grande che ci sta (1:20 … 1:1000), dichiarata nel cartiglio. Cartiglio su ogni pagina: logo, dati dell'azienda (salvati su questo computer, "Dati dell'azienda e logo"), cliente, progetto, data, scala, revisione, piano, foglio. Elenco senza prezzi (codice, articolo, quantità). Nei documenti (tavola, DXF, anteprima CRM) non compaiono gli avvisi dei controlli né il punto di partenza della visita. Usa `exportSheetsToPdf` dell'editor; codice: `tavola.ts`, `tavola-section.tsx`, `intestazione-store.ts`.

### 9b. Varianti dello stesso progetto (da decidere)

## Fase 7: rilascio

`README` nuovo, `THIRD_PARTY_NOTICES.md` completo, `LICENSE`, nome e logo, CI. Controllare un'ultima volta `ASSETS.md` e le licenze di tutte le dipendenze.

## Rischi da tenere d'occhio

- Il commit di partenza è un'istantanea: gli aggiornamenti di Pascal non si fondono da soli. Se si vuole seguirli, tenere il remote `upstream` e unire a mano, ma solo codice (mai asset).
- Il `bun.lock` è di upstream: dopo aver tolto i plugin va rigenerato (`bun install`) e riverificate le licenze nuove.
- Non ho eseguito l'app né i test del repository: tutto ciò che è scritto qui deriva dalla lettura del codice.
