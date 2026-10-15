# Registro degli asset

Regola: nessun modello 3D, texture, suono, font, icona o immagine entra nel repository senza una riga in questa tabella. La riga si scrive nello stesso commit del file.

Licenze ammesse: CC0, CC-BY (l'attribuzione va anche in `THIRD_PARTY_NOTICES.md`), MIT, Apache-2.0. Escluse: CC-BY-NC, CC-BY-ND, "solo uso personale" e licenze di marketplace che vietano la ridistribuzione.

Come si compila:
- **Fonte**: indirizzo della pagina da cui è stato scaricato il file, non solo il nome del sito.
- **Licenza**: quella indicata nella pagina in quel momento (copiare il testo esatto, per esempio "CC0 1.0").
- **Data**: giorno in cui è stata controllata.
- Se la licenza cambia in futuro, il file scaricato resta con la licenza di quando è stato scaricato: serve però una prova (schermata o archivio della pagina) nella cartella `docs/progetto/prove-licenza/`.

| File o cartella | Tipo | Autore | Fonte (URL) | Licenza | Attribuzione richiesta | Data verifica | Note |
|---|---|---|---|---|---|---|---|
| `packages/geometry-script/src/__fixtures__/blender/cabinet.glb` | Modello 3D (fixture di test) | Pascal Group Inc. | https://github.com/pascalorg/editor (commit `6343c62`) | MIT (codice del repository) | Nota MIT in `LICENSE` | 2026-10-15 | Generato da Blender con lo script `cabinet.py` nella stessa cartella (tre scatole). Solo per i test, non viene distribuito nell'app. |
| `packages/ifc-converter/tests/fixtures/*.ifc` | File IFC (fixture di test) | Pascal Group Inc. | https://github.com/pascalorg/editor (commit `6343c62`) | MIT (codice del repository) | Nota MIT in `LICENSE` | 2026-10-15 | 3 file da 3-4 KB; l'intestazione IFC indica Pascal come autore. Solo per i test. |
| `packages/editor/src/lib/floorplan/pdf-fonts/GeistMono-*.ttf` | Font | Vercel, con basement.studio | https://github.com/vercel/geist-font | SIL OFL 1.1 | Testo OFL in `LICENSE-GeistMono.txt` | 2026-10-15 | Usato per l'export PDF. |
| `packages/editor/src/lib/floorplan/pdf-fonts/LiberationSans-*.ttf` | Font | Red Hat, Inc. (dati Google) | https://github.com/liberationfonts/liberation-fonts | SIL OFL 1.1 | Testo OFL in `LICENSE-LiberationSans.txt` | 2026-10-15 | Usato per l'export PDF. |
| `apps/editor/app/fonts/GeistVF.woff`, `GeistMonoVF.woff`, `apps/editor/public/fonts/geist-regular.ttf` | Font | Vercel, con basement.studio | https://github.com/vercel/geist-font | SIL OFL 1.1 | Testo OFL da aggiungere a `THIRD_PARTY_NOTICES.md` | 2026-10-15 | Da verificare: il copyright non si legge in chiaro nel file (compresso). |
| `apps/editor/public/fonts/PlusJakartaSans-SemiBold.ttf` | Font | Tokotype | https://github.com/tokotype/PlusJakartaSans | SIL OFL 1.1 (da verificare nel file) | Testo OFL da aggiungere a `THIRD_PARTY_NOTICES.md` | 2026-10-15 | Da verificare. |
| `apps/editor/public/icons/*.webp`, `apps/editor/public/icons/fittings/*.webp` | Icone dell'interfaccia (91) | Pascal Group Inc. | https://github.com/pascalorg/editor (commit `6343c62`) | Origine non documentata | — | 2026-10-15 | **Da sostituire.** Restano solo perché senza di esse l'interfaccia non ha icone. Le 16 di `fittings/` sono generate con uno strumento di immagini AI (vedi il loro `README.md`). |
| `apps/editor/public/icons/horeca/*.svg` (banco-frigo, cella-frigo, lavello, generico) | Icone delle attrezzature | Disegnate per questo progetto | Questo repository | MIT (come il resto del progetto) | No | 2026-10-15 | Stesso stile del logo. |
| `apps/editor/app/icon.svg` (e lo stesso disegno nel componente `ProductMark` di `apps/editor/components/app-shell.tsx`) | Logo del progetto | Disegnato per questo progetto | Questo repository | MIT (come il resto del progetto) | No | 2026-10-15 | Sostituisce la favicon di Pascal, eliminata. Colori ripresi dalle icone del gestionale e del CRM dell'utente. |
| `docs/images/curtain-wall-variations.png` | Immagine (documentazione) | Pascal Group Inc. | https://github.com/pascalorg/editor (commit `6343c62`) | Origine non documentata | — | 2026-10-15 | Solo documentazione interna; da togliere se non serve. |
