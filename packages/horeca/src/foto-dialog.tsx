'use client'

import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ACESFilmicToneMapping, WebGPURenderer } from 'three/webgpu'
import { WebGPUPathTracer } from 'three-gpu-pathtracer/webgpu'
import { FOTO_ANNULLATO, type FotoJob, useFoto } from './render-store'
import { withLabels } from './render-system'

/**
 * The view lights the room with a sun plus flat fill lights tuned for it; traced light also
 * bounces off walls and floor, so the same exposure comes out washed: brought down by this.
 */
const EXPOSURE = 0.6

/** How long to wait for the first pass before telling the user it is not coming. */
const STALL_MS = 30_000

/** Samples per pixel at which the picture is called finished; most rooms are clean well before. */
export const FOTO_SAMPLES = 256

const BUTTON =
  'h-9 rounded-md border border-white/20 bg-white/10 px-4 text-sm text-white hover:bg-white/20 disabled:opacity-50'

type Tracer = { renderer: WebGPURenderer; tracer: WebGPUPathTracer }

/**
 * The photorealistic render: the frozen copy of the room is path traced on a canvas of its own,
 * one pass per frame, so the picture starts grainy and clears up while you watch. It stops by
 * itself at `FOTO_SAMPLES`, or when you save it; the 3D view is paused meanwhile, to leave the
 * graphics card to this.
 */
function FotoWindow({ job }: { job: FotoJob }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Tracer | null>(null)
  const saving = useRef(false)
  const counted = useRef(false)
  const [samples, setSamples] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const close = (png?: Blob, failure?: Error) => {
    useFoto.setState({ job: null })
    if (png) job.resolve(png)
    else job.reject(failure ?? new Error(FOTO_ANNULLATO))
  }

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    let stopped = false
    let frame = 0
    let stall: ReturnType<typeof setTimeout> | undefined
    const paused = useViewer.getState().renderPaused
    useViewer.getState().setRenderPaused(true)

    const start = async () => {
      element.width = job.width
      element.height = job.height
      const renderer = new WebGPURenderer({ canvas: element, antialias: false })
      renderer.setPixelRatio(1)
      renderer.setSize(job.width, job.height, false)
      renderer.toneMapping = ACESFilmicToneMapping
      renderer.toneMappingExposure = job.exposure * EXPOSURE
      await renderer.init()
      if (stopped) return renderer.dispose()
      const tracer = new WebGPUPathTracer(renderer)
      tracer.maxSamples = FOTO_SAMPLES
      tracer.renderDelay = 0
      tracer.fadeDuration = 0
      tracer.dynamicLowRes = false
      // Tangents serve normal maps, which the room has none of, and fail on the editor's batched
      // geometry (reserved, unused ranges).
      tracer.commonAttributes = ['normal']
      tracer.setScene(job.scene, job.camera)
      engine.current = { renderer, tracer }
      setReady(true)

      let lastCount = 0
      const tick = (time: number) => {
        if (stopped) return
        frame = requestAnimationFrame(tick)
        if (saving.current) return
        tracer.renderSample()
        if (time - lastCount > 700) {
          lastCount = time
          tracer.getSampleCountsAsync().then(
            (counts) => {
              if (stopped) return
              counted.current = counts.min >= 1
              setSamples(Math.floor(counts.min))
            },
            () => {},
          )
        }
      }
      frame = requestAnimationFrame(tick)
      // A shader the graphics card rejects fails quietly: nothing ever accumulates.
      stall = setTimeout(() => {
        if (!stopped && !counted.current)
          setError('la scheda grafica non riesce a calcolarlo. Prova il render veloce.')
      }, STALL_MS)
    }
    start().catch((e: unknown) => {
      console.error('[foto]', e)
      setError(e instanceof Error ? e.message : String(e))
    })

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      clearTimeout(stall)
      engine.current?.tracer.dispose()
      engine.current?.renderer.dispose()
      engine.current = null
      job.dispose()
      useViewer.getState().setRenderPaused(paused)
    }
  }, [job])

  const save = () => {
    const current = engine.current
    const element = canvas.current
    if (!(current && element) || saving.current) return
    saving.current = true
    // A WebGPU canvas is read in the same task it is drawn.
    current.tracer.renderSample()
    element.toBlob(async (png) => {
      if (!png) return close(undefined, new Error('Render non riuscito.'))
      try {
        close(job.labels.length ? await withLabels(png, job.labels, job.labelScale) : png)
      } catch (e) {
        close(undefined, e instanceof Error ? e : new Error(String(e)))
      }
    }, 'image/png')
  }

  const done = samples >= FOTO_SAMPLES
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-black/85 p-6">
      <div
        className="relative overflow-hidden rounded-md"
        style={{
          aspectRatio: `${job.width} / ${job.height}`,
          // As wide as fits both ways; the width is set, since the names measure from it.
          width: `min(100%, calc((100vh - 9rem) * ${job.width / job.height}))`,
          containerType: 'inline-size',
        }}
      >
        <canvas
          className="h-full w-full rounded-md bg-black shadow-2xl"
          ref={canvas}
          style={{ aspectRatio: `${job.width} / ${job.height}` }}
        />
        {/* The names, where saving draws them: shown over the picture while it clears up. */}
        {job.labels.map((label) => (
          <span
            className="pointer-events-none absolute whitespace-nowrap rounded-[0.5em] border border-black/15 bg-white/90 px-[0.66em] text-[#1f2328] shadow-sm"
            key={label.id}
            style={{
              left: `${((label.x * job.labelScale) / job.width) * 100}%`,
              top: `${((label.y * job.labelScale) / job.height) * 100}%`,
              transform: 'translate(-50%, -50%)',
              // 12 px in the view, scaled as the picture is: container width units.
              fontSize: `${((12 * job.labelScale) / job.width) * 100}cqw`,
              lineHeight: 1.6,
            }}
          >
            {label.text}
          </span>
        ))}
      </div>
      <div className="flex w-full max-w-xl flex-col gap-2 text-sm text-white">
        {error ? (
          <p className="text-amber-400">Il render fotorealistico non è partito: {error}</p>
        ) : (
          <>
            <div className="h-1.5 overflow-hidden rounded bg-white/15">
              <div
                className="h-full bg-white/80 transition-[width]"
                style={{ width: `${Math.min(100, (samples / FOTO_SAMPLES) * 100)}%` }}
              />
            </div>
            <p className="opacity-80">
              {!ready
                ? 'Preparo la scena…'
                : done
                  ? 'Finito. Salvalo nella galleria.'
                  : `L’immagine si affina: passaggio ${samples} di ${FOTO_SAMPLES}. Puoi salvarla quando ti piace.`}
            </p>
          </>
        )}
        <div className="flex justify-end gap-2">
          <button className={BUTTON} onClick={() => close()} type="button">
            Annulla
          </button>
          <button className={BUTTON} disabled={samples < 1 || !!error} onClick={save} type="button">
            Salva nella galleria
          </button>
        </div>
      </div>
    </div>
  )
}

/** Shows the photorealistic render window while one is running. */
export function FotoDialog() {
  const job = useFoto((s) => s.job)
  if (!job || typeof document === 'undefined') return null
  return createPortal(<FotoWindow job={job} />, document.body)
}
