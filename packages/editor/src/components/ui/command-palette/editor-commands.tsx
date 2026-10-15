'use client'

import { type AnyNodeId, type LevelNode, type UnitNode, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import {
  AppWindow,
  ArrowRight,
  Box,
  Building2,
  Camera,
  Copy,
  DoorOpen,
  Eye,
  EyeOff,
  FileJson,
  Grid3X3,
  Group,
  Hexagon,
  Layers,
  Map,
  Maximize2,
  Minimize2,
  Moon,
  MousePointer2,
  Mountain,
  Package,
  PaintBucket,
  PencilLine,
  Plus,
  Redo2,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Undo2,
  Video,
} from 'lucide-react'
import { useEffect } from 'react'
import { addStoreyOnTop } from '../../../lib/add-storey'
import { getHistoryCommandState, runRedo, runUndo } from '../../../lib/history'
import { deleteLevelWithFallbackSelection } from '../../../lib/level-selection'
import { getSavedSceneDocument } from '../../../lib/scene'
import { createUnitInBuilding, enterUnitFocus, leaveUnitFocus } from '../../../lib/units'
import { useCommandRegistry } from '../../../store/use-command-registry'
import type { StructureTool } from '../../../store/use-editor'
import useEditor from '../../../store/use-editor'
import { useCommandPalette } from './index'

export function EditorCommands() {
  const register = useCommandRegistry((s) => s.register)
  const { navigateTo, setInputValue, setOpen } = useCommandPalette()

  const armToolMode = useEditor((s) => s.armToolMode)
  const armMaterialPaint = useEditor((s) => s.armMaterialPaint)
  const isPreviewMode = useEditor((s) => s.isPreviewMode)
  const setPreviewMode = useEditor((s) => s.setPreviewMode)

  const exportScene = useViewer((s) => s.exportScene)
  // Focusable units are listed one command each; the key changes only when a
  // unit is added, removed or renamed.
  const unitListKey = useScene((s) =>
    Object.values(s.nodes)
      .filter((n): n is UnitNode => n.type === 'unit')
      .map((n) => `${n.id}:${n.name ?? ''}`)
      .join('|'),
  )

  // Re-register when exportScene availability changes (it's a conditional action)
  useEffect(() => {
    void unitListKey
    const run = (fn: () => void) => {
      fn()
      setOpen(false)
    }
    const focusableUnits = Object.values(useScene.getState().nodes).filter(
      (n): n is UnitNode => n.type === 'unit',
    )

    const activateTool = (tool: StructureTool) => {
      run(() => armToolMode({ mode: 'build', tool }))
    }

    return register([
      // ── Scene ────────────────────────────────────────────────────────────
      {
        id: 'editor.tool.wall',
        label: 'Strumento Muro',
        group: 'Scena',
        icon: <Square className="h-4 w-4" />,
        keywords: ['draw', 'build', 'structure', 'muro', 'disegna', 'costruisci', 'struttura'],
        execute: () => activateTool('wall'),
      },
      {
        id: 'editor.tool.slab',
        label: 'Strumento Solaio',
        group: 'Scena',
        icon: <Layers className="h-4 w-4" />,
        keywords: ['floor', 'build', 'solaio', 'pavimento', 'costruisci'],
        execute: () => activateTool('slab'),
      },
      {
        id: 'editor.tool.ceiling',
        label: 'Strumento Soffitto',
        group: 'Scena',
        icon: <Grid3X3 className="h-4 w-4" />,
        keywords: ['top', 'build', 'soffitto', 'costruisci'],
        execute: () => activateTool('ceiling'),
      },
      {
        id: 'editor.tool.door',
        label: 'Strumento Porta',
        group: 'Scena',
        icon: <DoorOpen className="h-4 w-4" />,
        keywords: ['opening', 'entrance', 'porta', 'apertura', 'ingresso'],
        execute: () => activateTool('door'),
      },
      {
        id: 'editor.tool.window',
        label: 'Strumento Finestra',
        group: 'Scena',
        icon: <AppWindow className="h-4 w-4" />,
        keywords: ['opening', 'glass', 'finestra', 'apertura', 'vetro'],
        execute: () => activateTool('window'),
      },
      {
        id: 'editor.tool.item',
        label: 'Strumento Oggetto',
        group: 'Scena',
        icon: <Package className="h-4 w-4" />,
        keywords: ['furniture', 'object', 'asset', 'furnish', 'oggetto', 'arredi', 'arreda'],
        execute: () => activateTool('item'),
      },
      {
        id: 'editor.tool.stair',
        label: 'Strumento Scala',
        group: 'Scena',
        icon: <ArrowRight className="h-4 w-4" />,
        keywords: ['stairs', 'staircase', 'flight', 'landing', 'steps', 'scala', 'rampa', 'pianerottolo', 'gradini'],
        execute: () => activateTool('stair'),
      },
      {
        id: 'editor.tool.zone',
        label: 'Strumento Zona',
        group: 'Scena',
        icon: <Hexagon className="h-4 w-4" />,
        keywords: ['area', 'room', 'space', 'zona', 'stanza', 'spazio'],
        execute: () => activateTool('zone'),
      },
      {
        id: 'editor.delete-selection',
        label: 'Elimina selezione',
        group: 'Scena',
        icon: <Trash2 className="h-4 w-4" />,
        keywords: ['remove', 'erase', 'elimina', 'cancella', 'rimuovi'],
        shortcut: ['⌫'],
        when: () => useViewer.getState().selection.selectedIds.length > 0,
        execute: () =>
          run(() => {
            const { selectedIds } = useViewer.getState().selection
            useScene.getState().deleteNodes(selectedIds as any[])
          }),
      },
      {
        id: 'editor.mode.material-paint',
        label: 'Dipingi materiale',
        group: 'Scena',
        icon: <PaintBucket className="h-4 w-4" />,
        keywords: ['paint', 'material', 'texture', 'bucket', 'surface', 'dipingi', 'materiale', 'superficie'],
        shortcut: ['P'],
        execute: () =>
          run(() => armMaterialPaint()),
      },
      {
        id: 'editor.mode.terrain-sculpt',
        label: 'Modella terreno',
        group: 'Scena',
        icon: <Mountain className="h-4 w-4" />,
        keywords: ['terrain', 'ground', 'elevation', 'sculpt', 'hill', 'slope', 'grade', 'dig', 'terreno', 'modella', 'pendenza', 'scava'],
        shortcut: ['G'],
        // The ToolMode transition moves to the site phase itself.
        execute: () => run(() => armToolMode({ mode: 'terrain-sculpt' })),
      },

      // ── Levels ───────────────────────────────────────────────────────────
      {
        id: 'editor.level.goto',
        label: 'Vai al piano',
        group: 'Piani',
        icon: <ArrowRight className="h-4 w-4" />,
        keywords: ['level', 'floor', 'go', 'navigate', 'switch', 'select', 'piano', 'vai'],
        navigate: true,
        when: () => Object.values(useScene.getState().nodes).some((n) => n.type === 'level'),
        execute: () => navigateTo('goto-level'),
      },
      {
        id: 'editor.level.add',
        label: 'Aggiungi piano',
        group: 'Piani',
        icon: <Plus className="h-4 w-4" />,
        keywords: ['level', 'floor', 'add', 'create', 'new', 'piano', 'aggiungi', 'nuovo'],
        execute: () =>
          run(() => {
            const { nodes } = useScene.getState()
            const building = Object.values(nodes).find((n) => n.type === 'building')
            if (!building) return
            const newLevel = addStoreyOnTop(building.id)
            useViewer.getState().setSelection({ levelId: newLevel.id })
          }),
      },
      {
        id: 'editor.level.rename',
        label: 'Rinomina piano',
        group: 'Piani',
        icon: <PencilLine className="h-4 w-4" />,
        keywords: ['level', 'floor', 'rename', 'name', 'piano', 'rinomina', 'nome'],
        navigate: true,
        when: () => !!useViewer.getState().selection.levelId,
        execute: () => {
          const activeLevelId = useViewer.getState().selection.levelId
          if (!activeLevelId) return
          const level = useScene.getState().nodes[activeLevelId as AnyNodeId] as LevelNode
          setInputValue(level?.name ?? '')
          navigateTo('rename-level')
        },
      },
      {
        id: 'editor.level.delete',
        label: 'Elimina piano',
        group: 'Piani',
        icon: <Trash2 className="h-4 w-4" />,
        keywords: ['level', 'floor', 'delete', 'remove', 'piano', 'elimina'],
        when: () => {
          const levelId = useViewer.getState().selection.levelId
          if (!levelId) return false
          const node = useScene.getState().nodes[levelId as AnyNodeId] as LevelNode
          return node?.type === 'level' && node.level !== 0
        },
        execute: () =>
          run(() => {
            const activeLevelId = useViewer.getState().selection.levelId
            if (!activeLevelId) return
            deleteLevelWithFallbackSelection(activeLevelId as AnyNodeId)
          }),
      },

      // ── Units ────────────────────────────────────────────────────────────
      {
        id: 'editor.unit.new',
        label: 'Nuova unità',
        group: 'Unità',
        icon: <Group className="h-4 w-4" />,
        keywords: ['unit', 'apartment', 'hotel', 'room', 'add', 'create', 'new', 'unità', 'appartamento', 'camera', 'nuova'],
        when: () => Object.values(useScene.getState().nodes).some((n) => n.type === 'building'),
        execute: () =>
          run(() => {
            const { nodes } = useScene.getState()
            const selectedBuildingId = useViewer.getState().selection.buildingId
            const building =
              (selectedBuildingId ? nodes[selectedBuildingId] : undefined) ??
              Object.values(nodes).find((n) => n.type === 'building')
            if (building?.type !== 'building') return
            createUnitInBuilding(building.id)
          }),
      },
      ...focusableUnits.map((unit) => ({
        id: `editor.unit.focus.${unit.id}`,
        label: `Isola l'unità: ${unit.name || 'Unità'}`,
        group: 'Unità',
        icon: <Group className="h-4 w-4" />,
        keywords: ['unit', 'focus', 'apartment', 'unità', 'isola', unit.name || 'Unità'],
        when: () => useViewer.getState().focusedUnitId !== unit.id,
        execute: () => run(() => enterUnitFocus(unit.id)),
      })),
      {
        id: 'editor.unit.exit-focus',
        label: "Esci dall'unità isolata",
        group: 'Unità',
        icon: <Group className="h-4 w-4" />,
        keywords: ['unit', 'focus', 'exit', 'leave', 'apartment', 'unità', 'esci'],
        when: () => !!useViewer.getState().focusedUnitId,
        execute: () => run(() => leaveUnitFocus()),
      },

      // ── Viewer Controls ──────────────────────────────────────────────────
      {
        id: 'editor.viewer.wall-mode',
        label: 'Modalità muri',
        group: 'Controlli della vista',
        icon: <Layers className="h-4 w-4" />,
        keywords: ['wall', 'cutaway', 'up', 'down', 'translucent', 'view', 'muri', 'spaccato', 'alti', 'bassi', 'trasparenti'],
        badge: () => {
          const mode = useViewer.getState().wallMode
          return { cutaway: 'Sezionati', up: 'Alti', down: 'Bassi', translucent: 'Trasparenti' }[mode]
        },
        navigate: true,
        execute: () => navigateTo('wall-mode'),
      },
      {
        id: 'editor.viewer.camera-mode',
        label: () => {
          const mode = useViewer.getState().cameraMode
          return `Vista: passa a ${mode === 'perspective' ? 'ortogonale' : 'prospettica'}`
        },
        group: 'Controlli della vista',
        icon: <Video className="h-4 w-4" />,
        keywords: ['camera', 'ortho', 'perspective', '2d', '3d', 'view', 'vista', 'ortogonale', 'prospettiva'],
        execute: () =>
          run(() => {
            const { cameraMode, setCameraMode } = useViewer.getState()
            setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')
          }),
      },
      {
        id: 'editor.viewer.shading-solid',
        label: 'Passa a Solido',
        group: 'Controlli della vista',
        icon: <Box className="h-4 w-4" />,
        keywords: ['solid', 'shading', 'render', 'mode', 'performance', 'solido', 'ombreggiatura', 'prestazioni'],
        execute: () => run(() => useViewer.getState().setShading('solid')),
      },
      {
        id: 'editor.viewer.shading-rendered',
        label: 'Passa a Renderizzato',
        group: 'Controlli della vista',
        icon: <Sparkles className="h-4 w-4" />,
        keywords: ['rendered', 'shading', 'render', 'mode', 'quality', 'renderizzato', 'ombreggiatura', 'qualità'],
        execute: () => run(() => useViewer.getState().setShading('rendered')),
      },
      {
        id: 'editor.viewer.camera-snapshot',
        label: "Scatta un'istantanea",
        group: 'Controlli della vista',
        icon: <Camera className="h-4 w-4" />,
        keywords: ['camera', 'snapshot', 'capture', 'save', 'view', 'bookmark', 'istantanea', 'scatta', 'vista', 'salva'],
        execute: () => {
          setOpen(false)
          useEditor.getState().setCaptureMode(true)
        },
      },

      // ── View ─────────────────────────────────────────────────────────────
      {
        id: 'editor.view.preview',
        label: () => (isPreviewMode ? "Esci dall'anteprima" : 'Apri anteprima'),
        group: 'Visualizzazione',
        icon: isPreviewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
        keywords: ['preview', 'view', 'read-only', 'present', 'anteprima', 'presenta'],
        execute: () => run(() => setPreviewMode(!isPreviewMode)),
      },
      {
        id: 'editor.view.fullscreen',
        label: 'Attiva/disattiva schermo intero',
        group: 'Visualizzazione',
        icon: <Maximize2 className="h-4 w-4" />,
        keywords: ['fullscreen', 'maximize', 'expand', 'window', 'schermo intero', 'ingrandisci'],
        execute: () =>
          run(() => {
            if (document.fullscreenElement) document.exitFullscreen()
            else document.documentElement.requestFullscreen()
          }),
      },

      // ── History ──────────────────────────────────────────────────────────
      {
        id: 'editor.history.undo',
        label: 'Annulla',
        group: 'Cronologia',
        icon: <Undo2 className="h-4 w-4" />,
        keywords: ['undo', 'revert', 'back', 'annulla', 'indietro'],
        when: () => getHistoryCommandState().canUndo,
        execute: () => run(() => runUndo()),
      },
      {
        id: 'editor.history.redo',
        label: 'Ripeti',
        group: 'Cronologia',
        icon: <Redo2 className="h-4 w-4" />,
        keywords: ['redo', 'forward', 'repeat', 'ripeti', 'avanti'],
        when: () => getHistoryCommandState().canRedo,
        execute: () => run(() => runRedo()),
      },

      // ── Export & Share ───────────────────────────────────────────────────
      {
        id: 'editor.export.json',
        label: 'Esporta scena (JSON)',
        group: 'Esporta e condividi',
        icon: <FileJson className="h-4 w-4" />,
        keywords: ['export', 'download', 'json', 'save', 'data', 'esporta', 'scarica', 'salva', 'dati'],
        execute: () =>
          run(() => {
            const { nodes, rootNodeIds } = getSavedSceneDocument()
            const blob = new Blob([JSON.stringify({ nodes, rootNodeIds }, null, 2)], {
              type: 'application/json',
            })
            const url = URL.createObjectURL(blob)
            Object.assign(document.createElement('a'), {
              href: url,
              download: `scene_${new Date().toISOString().split('T')[0]}.json`,
            }).click()
            URL.revokeObjectURL(url)
          }),
      },
      ...(exportScene
        ? [
            {
              id: 'editor.export.glb',
              label: 'Esporta modello 3D (GLB)',
              group: 'Esporta e condividi',
              icon: <Box className="h-4 w-4" />,
              keywords: ['export', 'glb', 'gltf', '3d', 'model', 'download', 'esporta', 'modello', 'scarica'],
              execute: () => run(() => exportScene()),
            },
          ]
        : []),
      {
        id: 'editor.export.share-link',
        label: 'Copia link di condivisione',
        group: 'Esporta e condividi',
        icon: <Copy className="h-4 w-4" />,
        keywords: ['share', 'copy', 'url', 'link', 'condividi', 'copia'],
        execute: () => run(() => navigator.clipboard.writeText(window.location.href)),
      },
      {
        id: 'editor.export.screenshot',
        label: 'Cattura schermata',
        group: 'Esporta e condividi',
        icon: <Camera className="h-4 w-4" />,
        keywords: ['screenshot', 'capture', 'image', 'photo', 'png', 'schermata', 'cattura', 'immagine', 'foto'],
        execute: () =>
          run(() => {
            const canvas = document.querySelector('canvas')
            if (!canvas) return
            Object.assign(document.createElement('a'), {
              href: canvas.toDataURL('image/png'),
              download: `screenshot_${new Date().toISOString().split('T')[0]}.png`,
            }).click()
          }),
      },
    ])
  }, [
    register,
    navigateTo,
    setInputValue,
    setOpen,
    armToolMode,
    armMaterialPaint,
    isPreviewMode,
    setPreviewMode,
    exportScene,
    unitListKey,
  ])

  return null
}
