# 3DCadHo.Re.Ca

Editor 2D/3D open source per progettare il layout di locali e laboratori Ho.Re.Ca: pianta in 2D, vista in 3D, arredi e attrezzature, distinta materiali verso il CRM.

Basato su [pascalorg/editor](https://github.com/pascalorg/editor) (commit `6343c62`, licenza MIT, © 2026 Pascal Group Inc.). Questo progetto non è affiliato a Pascal e non ne usa nome o logo.

## Avvio

Servono Node 22.13+ e Bun.

```sh
bun install
bun dev        # dalla radice; apre http://localhost:3002
bun run ci     # controlli, tipi, test e build
```

## Documenti

- `CLAUDE.md`: obiettivi, decisioni prese e aperte, regole di licenza.
- `docs/progetto/PIANO.md`: fasi del lavoro.
- `docs/progetto/AUDIT_LICENZE.md`: cosa è stato tolto da upstream e perché.
- `ASSETS.md`: registro di ogni modello, texture, suono, font o icona.
- `THIRD_PARTY_NOTICES.md`: avvisi delle dipendenze.
- `AGENTS.md`, `DECISIONS.md`, `wiki/`: architettura e convenzioni di upstream.

## Licenza

MIT, vedi `LICENSE`. © 2026 Pascal Group Inc. (codice di partenza), © 2026 Jacopo Donà (modifiche).
