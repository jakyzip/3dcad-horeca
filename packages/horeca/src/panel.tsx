'use client'

import { nodeRegistry, useScene } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useMemo } from 'react'
import { EQUIPMENT_KINDS } from './definitions'
import {
  buildDistinta,
  type Distinta,
  type DistintaNode,
  distintaCsv,
  distintaHash,
} from './distinta'

function armTool(kind: string) {
  const editor = useEditor.getState()
  useViewer.getState().setSelection({ selectedIds: [], zoneId: null })
  editor.setPhase('building')
  editor.setCatalogCategory(null)
  editor.setToolDefaults(kind, null)
  editor.setMode('build')
  editor.setTool(kind)
}

function download(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * The scene's distinta as JSON in the CRM's `invia_distinta` shape. The drawing, customer and deal
 * ids come with the CRM link (phase 4); until then they are left out.
 */
async function distintaJson(distinta: Distinta, name: string): Promise<string> {
  const items = distinta.rows
  return `${JSON.stringify({ schema: 1, name, items_hash: await distintaHash(items), items }, null, 2)}\n`
}

const BUTTON =
  'h-8 rounded-md border border-border/60 bg-background px-3 text-foreground text-xs hover:bg-accent disabled:opacity-50'

/** Sidebar panel: place equipment, read the distinta, export it. */
export default function HorecaPanel() {
  const nodes = useScene((s) => s.nodes)
  const distinta = useMemo(
    () => buildDistinta(nodes as unknown as Record<string, DistintaNode>),
    [nodes],
  )
  const empty = distinta.rows.length === 0
  const name = 'distinta'

  return (
    <div className="flex flex-col gap-4 p-3 text-sidebar-foreground text-sm">
      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-xs uppercase tracking-wide opacity-60">Attrezzature</h3>
        <div className="grid grid-cols-1 gap-1.5">
          {EQUIPMENT_KINDS.map((kind) => {
            const presentation = nodeRegistry.get(kind)?.presentation
            return (
              <button
                className={`${BUTTON} flex items-center gap-2 text-left`}
                key={kind}
                onClick={() => armTool(kind)}
                type="button"
              >
                {presentation?.icon.kind === 'url' && (
                  <img alt="" className="h-5 w-5" src={presentation.icon.src} />
                )}
                {presentation?.label ?? kind}
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-xs uppercase tracking-wide opacity-60">Distinta</h3>
        {empty ? (
          <p className="text-xs opacity-60">
            Nessun articolo. Piazza un’attrezzatura e compila codice, articolo e ID CRM
            nell’inspector.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left opacity-60">
                <th className="py-1 font-normal">Codice</th>
                <th className="py-1 font-normal">Articolo</th>
                <th className="py-1 text-right font-normal">Q.tà</th>
              </tr>
            </thead>
            <tbody>
              {distinta.rows.map((row) => (
                <tr className="border-border/40 border-t" key={row.item_id}>
                  <td className="py-1 pr-2 font-mono">{row.code || '—'}</td>
                  <td className="py-1 pr-2">{row.name || '—'}</td>
                  <td className="py-1 text-right tabular-nums">{row.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {distinta.invalid > 0 && (
          <p className="text-amber-500 text-xs">
            {distinta.invalid} elementi hanno un ID CRM non valido e non sono contati.
          </p>
        )}
        <div className="flex gap-2">
          <button
            className={BUTTON}
            disabled={empty}
            onClick={() => download(`${name}.csv`, 'text/csv;charset=utf-8', distintaCsv(distinta))}
            type="button"
          >
            Scarica CSV
          </button>
          <button
            className={BUTTON}
            disabled={empty}
            onClick={async () =>
              download(`${name}.json`, 'application/json', await distintaJson(distinta, name))
            }
            type="button"
          >
            Scarica JSON
          </button>
        </div>
      </section>
    </div>
  )
}
