# 3DCadHo.Re.Ca: CAD 2D/3D open source per layout Ho.Re.Ca

@AGENTS.md

Le convenzioni di codice e l'architettura di upstream stanno in `AGENTS.md` (importato sopra) e in `DECISIONS.md`. Questo file descrive cosa facciamo di diverso. Stato e prossimi passi: `docs/progetto/PIANO.md`.

## Cos'è

Fork di Pascal Editor (`pascalorg/editor`, commit `6343c62`, licenza MIT, © 2026 Pascal Group Inc.). Il fork nasce senza gli asset di Pascal (modelli 3D, texture, suoni) perché non hanno licenza documentata: vedi `docs/progetto/AUDIT_LICENZE.md`.

Obiettivo del prodotto, gratuito e open source (MIT):
- disegnare in 2D la pianta di un locale (anche partendo da un rilievo) e vederlo in 3D, nello stile di Live Home 3D / Sweet Home 3D;
- piazzare arredi e attrezzature di laboratorio Ho.Re.Ca (banchi frigo, celle, vetrine, lavelli inox, cappe, ecc.);
- ogni elemento inserito compila da solo la distinta materiali e il preventivo;
- esportare la distinta verso il CRM dell'utente (`crm_donà`, Next.js + Supabase; vedi "Contratto con il CRM" sotto);
- render di qualità media, non iper dettagliato;
- girare su Mac, Windows e Linux.

## Decisioni già prese

- Base: Pascal Editor (TypeScript, Next.js, React Three Fiber, Zustand, Zod). Ha già 2D (pannello Floorplan), 3D, export PDF multi-foglio con "schedule" (tabelle), export GLB/USDZ/IFC, salvataggio SQLite locale e un server MCP.
- La scena è la fonte dei dati: la distinta è un raggruppamento sugli elementi della scena. Codice articolo, descrizione, prezzo e fornitore vanno in `metadata` del nodo (`BaseNode.metadata`, un record libero).
- Il punto di aggancio per le tabelle è l'estensione `extensions['pascal:editor/floorplan'].schedule` della definizione di nodo (`packages/editor/src/lib/floorplan/floorplan-extension.ts`).
- Le estensioni si scrivono come plugin (`Plugin` con `nodes`, vedi `wiki/architecture/plugin-authoring.md`), non come modifiche ai nodi incorporati.
- Il catalogo parte vuoto. I nodi parametrici (armadio, HVAC, tubi, canali) sono definiti da schemi nel codice e non dipendono dai GLB.

- Copyright delle modifiche: Jacopo Donà (riga in `LICENSE` sotto quella di Pascal Group Inc., che resta).
- Nome: **3DCadHo.Re.Ca** (costante `PRODUCT_NAME` in `apps/editor/components/app-shell.tsx`). Logo: cubo isometrico, `apps/editor/app/icon.svg` e componente `ProductMark` (stessi disegni).
- Contratto con il CRM: lo stesso del CAD in Rust `horeca-cad` (branch `collegamento-crm`), descritto in `crm_donà/docs/disegni-cad.md`. Login Supabase, poi `rpc('invia_distinta', {p})`; payload schema 1 `{schema, drawing_id, name, account_id, deal_id, items_hash, items:[{item_id, code, name, quantity}]}`; il CAD non manda prezzi (il preventivo lo fa il CRM). `items_hash` = SHA-256 esadecimale minuscolo delle righe `"{item_id}\t{quantity}\t{code}\t{name}\n"` in ordine canonico (riferimento: `horeca-cad-crm/crates/horeca/src/distinta.rs`, da riscrivere in TypeScript, non copiare il codice Rust riga per riga senza capirlo).

## Decisioni ancora aperte (chiedile all'utente, non scegliere da solo)

- Versione desktop con Tauri oppure web self-hosted. Con Tauri serve un processo Node o Bun incluso nell'app, perché le API e il salvataggio SQLite stanno lato server.
- Libreria per DXF (import del rilievo, export) e per il path tracing: da scegliere e di cui controllare la licenza.

## Regole di licenza (non negoziabili)

1. Nessun file di asset senza una riga in `ASSETS.md` (fonte con URL, autore, licenza, data di verifica). Licenze ammesse: CC0, CC-BY (con attribuzione in `THIRD_PARTY_NOTICES.md`), MIT, Apache-2.0. Escluse: CC-BY-NC, CC-BY-ND, "solo uso personale" e qualunque licenza di marketplace che vieti la ridistribuzione.
2. Nuova dipendenza npm: prima `npm view <pacchetto> license` e lettura del suo LICENSE; aggiornare `THIRD_PARTY_NOTICES.md`. Niente PolyForm, BUSL, SSPL, GPL, AGPL. LGPL e MPL-2.0 solo se non modificate e con nota.
3. Non copiare codice GPL (per esempio Sweet Home 3D) nel progetto: renderebbe impossibile mantenerlo MIT. Ispirarsi alle funzioni è lecito, copiare il codice no.
4. Non usare "Pascal" nel nome, nel logo o nei testi rivolti agli utenti. Si conserva però la nota di copyright originale nel file `LICENSE` e si cita la base ("basato su pascalorg/editor").
5. Nessuna richiesta di rete verso i servizi di Pascal a runtime: `editor.pascal.app`, `map.pascal.app` e il loro Supabase (`byrpxoiotywskoojsrzd.supabase.co`). Il Supabase del CRM dell'utente è ammesso, solo per il collegamento al CRM e con l'indirizzo letto dalla configurazione, mai scritto nel codice.

## Comandi

Servono Node 22.13+ e Bun.
- `bun install`
- `bun dev`, sempre dalla radice (apre http://localhost:3002)
- `bun run ci` (check, tipi, test, build): da far passare prima di ogni commit. La validazione delle skill di upstream è stata tolta insieme ai plugin per agenti di Pascal (fase 0).

## Come lavorare con l'utente

- Italiano, spiegazioni semplici; l'utente non è uno sviluppatore di professione.
- Per ogni fase: cosa cambia, come lo verifichi, cosa resta aperto.
- Non dichiarare finita una modifica senza aver eseguito `bun run ci` o almeno i test del pacchetto toccato; se non puoi eseguirli, dillo.
