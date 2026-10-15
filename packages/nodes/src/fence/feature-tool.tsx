'use client'

import {
  type AnyNodeId,
  emitter,
  type FenceEvent,
  type FenceFeatureData,
  FenceGateNode,
  type FenceNode,
  FenceOpeningNode,
  FenceStyle,
  fenceFeaturePlacementIssue,
  fenceWithFeatures,
  type GridEvent,
  useLiveNodeOverrides,
} from '@pascal-app/core'
import {
  markToolCancelConsumed,
  triggerSFX,
  useEditor,
  useRegistryToolContext,
} from '@pascal-app/editor'
import { useEffect } from 'react'
import { pickFenceTarget } from '../fence-feature/pick-target'

export default function FenceFeatureTool({ kind }: { kind: 'gate' | 'opening' }) {
  const { activeLevelId, sceneApi, selectNode } = useRegistryToolContext()
  useEffect(() => {
    let previewId: FenceNode['id'] | undefined
    let finished = false
    const featureId = crypto.randomUUID()
    const clear = () => {
      if (!previewId) return
      useLiveNodeOverrides.getState().clearFields(previewId, ['features'])
      sceneApi.markDirty(previewId)
      previewId = undefined
    }
    const setFeedback = (message?: string) => {
      const defaults = useEditor.getState().toolDefaults.fence
      if (defaults?.featurePlacementFeedback === message) return
      useEditor
        .getState()
        .setToolDefaults('fence', { ...defaults, featurePlacementFeedback: message })
    }
    const candidate = (
      point: readonly [number, number],
      host?: FenceNode,
      ray?: GridEvent['localRay'],
    ) => {
      const nodes = sceneApi.nodes()
      const best = pickFenceTarget(point, host, ray, sceneApi, activeLevelId)
      if (!best) return { issue: 'Fai clic su una recinzione per posizionare l’elemento.' }
      const defaults = useEditor.getState().toolDefaults.fence
      const selectedStyle = FenceStyle.safeParse(defaults?.featureStyle)
      const feature: FenceFeatureData = {
        id: featureId,
        kind,
        center: best.center,
        width: typeof defaults?.featureWidth === 'number' ? defaults.featureWidth : 1.1,
        matchFenceStyle: defaults?.featureMatchStyle !== false,
        leafType: defaults?.featureLeafType === 'double' ? 'double' : 'single',
        height:
          defaults?.featureMatchStyle === false
            ? Math.max(0.3, best.fence.height - 0.22)
            : undefined,
        clearance: defaults?.featureMatchStyle === false ? best.fence.groundClearance : undefined,
        style:
          defaults?.featureMatchStyle === false && selectedStyle.success
            ? selectedStyle.data
            : 'match',
        hinge: 'left',
        swing: 'inward',
        openAngle: 0,
        frameWidth: defaults?.featureMatchStyle === false ? 0.055 : undefined,
        thickness: defaults?.featureMatchStyle === false ? 0.06 : undefined,
        spacing: defaults?.featureMatchStyle === false ? 0.15 : undefined,
        boardWidth: defaults?.featureMatchStyle === false ? 0.055 : undefined,
        brace: 'none',
        showHardware: true,
        showPosts: true,
      }
      const issue = fenceFeaturePlacementIssue(
        fenceWithFeatures(
          best.fence,
          (best.fence.children ?? []).map((id) => nodes[id as AnyNodeId]).filter(Boolean),
        ),
        feature,
      )
      return issue
        ? {
            issue:
              issue === 'overlap'
                ? 'Qui si sovrappone a un altro cancello o passaggio. Scegli un tratto libero.'
                : issue === 'end'
                  ? 'Allontanati dall’estremità della recinzione o riduci la larghezza dell’apertura.'
                  : 'L’apertura deve essere larga almeno 0,35 m.',
          }
        : { hit: { fence: best.fence, feature } }
    }
    const update = (
      point: readonly [number, number],
      host?: FenceNode,
      ray?: GridEvent['localRay'],
    ) => {
      clear()
      const { hit, issue } = candidate(point, host, ray)
      if (hit) {
        setFeedback(undefined)
        previewId = hit.fence.id
        useLiveNodeOverrides.getState().set(previewId, { features: [hit.feature] })
        sceneApi.markDirty(previewId)
      }
      return { hit, issue }
    }
    const commit = (
      point: readonly [number, number],
      host?: FenceNode,
      ray?: GridEvent['localRay'],
    ) => {
      if (finished) return
      const { hit, issue } = update(point, host, ray)
      if (!hit) {
        setFeedback(issue)
        return
      }
      finished = true
      clear()
      const { id: _id, kind: _kind, ...data } = hit.feature
      const schema = kind === 'gate' ? FenceGateNode : FenceOpeningNode
      const child = schema.parse({
        ...data,
        parentId: hit.fence.id,
        name: kind === 'gate' ? 'Cancello' : 'Passaggio',
      })
      sceneApi.upsert(child, hit.fence.id)
      triggerSFX('sfx:item-place')
      useEditor.getState().setMode('select')
      useEditor.getState().setTool(null)
      useEditor.getState().setToolDefaults('fence', null)
      selectNode(child.id)
    }
    const onMove = (event: GridEvent) => {
      update([event.localPosition[0], event.localPosition[2]], undefined, event.localRay)
    }
    const onClick = (event: GridEvent) => {
      commit([event.localPosition[0], event.localPosition[2]], undefined, event.localRay)
    }
    const onFenceMove = (event: FenceEvent) => {
      update([event.localPosition[0], event.localPosition[2]], event.node)
    }
    const onFenceClick = (event: FenceEvent) => {
      commit([event.localPosition[0], event.localPosition[2]], event.node)
      event.stopPropagation()
    }
    const cancel = () => {
      clear()
      markToolCancelConsumed()
      useEditor.getState().setMode('select')
      useEditor.getState().setTool(null)
      useEditor.getState().setToolDefaults('fence', null)
    }
    emitter.on('grid:move', onMove)
    emitter.on('grid:click', onClick)
    emitter.on('fence:move', onFenceMove)
    emitter.on('fence:click', onFenceClick)
    emitter.on('tool:cancel', cancel)
    return () => {
      clear()
      emitter.off('grid:move', onMove)
      emitter.off('grid:click', onClick)
      emitter.off('fence:move', onFenceMove)
      emitter.off('fence:click', onFenceClick)
      emitter.off('tool:cancel', cancel)
    }
  }, [activeLevelId, kind, sceneApi, selectNode])
  return null
}
