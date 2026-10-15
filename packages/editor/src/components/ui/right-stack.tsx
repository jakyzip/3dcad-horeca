'use client'

import { createContext, type ReactNode, useContext, useEffect, useRef } from 'react'
import { useIsMobile } from '../../hooks/use-mobile'
import { useRightDockWidth } from '../../lib/right-dock-width'
import { cn } from '../../lib/utils'
import { TOP_MENU_CLEARANCE } from './action-menu/placement'

const RightStackContext = createContext(false)
const RightDockContext = createContext(false)

/** Whether a panel renders inside the shared right column (in flow) rather than on its own. */
export function useInRightStack() {
  return useContext(RightStackContext)
}

/** Whether a panel renders in the docked right column beside the stage (`RightDock`). */
export function useInRightDock() {
  return useContext(RightDockContext)
}

/** The inspector never shrinks below this (or its own height, if shorter) for the card, px. */
const INSPECTOR_MIN_HEIGHT = 180

/** Gap between the inspector and the card, px (`gap-2`). */
const GAP = 8

/**
 * The heights neither panel shrinks below. The inspector keeps 180 px (or its
 * own height, if shorter) while the full card fits under it, and never less
 * than its header row. The card shows in full whenever the column allows; on a
 * very short window it gives way and scrolls on itself — both stay usable.
 */
export function rightStackFloors(args: {
  naturalHeight: number
  headerHeight: number
  cardHeight: number
  stackHeight: number
}): { inspector: number; card: number } {
  const { naturalHeight, headerHeight, cardHeight, stackHeight } = args
  const gap = naturalHeight > 0 && cardHeight > 0 ? GAP : 0
  const header = Math.min(headerHeight, naturalHeight)
  const inspector = Math.max(
    header,
    Math.min(INSPECTOR_MIN_HEIGHT, naturalHeight, stackHeight - cardHeight - gap),
  )
  const card = Math.max(0, Math.min(cardHeight, stackHeight - gap - inspector))
  return { inspector, card }
}

/** The inspector's full height: its header plus everything its scroller holds. */
function inspectorHeights(slot: HTMLElement): { natural: number; header: number } {
  const panel = slot.querySelector<HTMLElement>('[data-panel-wrapper]')
  if (!panel) return { natural: 0, header: 0 }
  const header = panel.querySelector<HTMLElement>('[data-panel-header]')?.offsetHeight ?? 0
  const scroller = panel.querySelector<HTMLElement>('[data-panel-scroll]')
  if (!scroller) return { natural: panel.offsetHeight, header }
  return { natural: panel.offsetHeight - scroller.clientHeight + scroller.scrollHeight, header }
}

/**
 * The right-hand column: the shortcuts card shows in full at the bottom, and
 * the node inspector takes the space above it, growing down from the top and
 * scrolling on itself. On a very short window the inspector keeps its header
 * and the card scrolls instead. Neither hides the other. On a phone the two
 * keep their own layouts (sheet / no card).
 */
export function RightStack({
  inspector,
  helper,
  reserveBottomMenu = true,
  belowTopMenu = false,
}: {
  inspector: ReactNode
  helper: ReactNode
  // Keep clear of an action menu docked at the bottom; off when it sits at the top.
  reserveBottomMenu?: boolean
  // Start below an action menu docked at the top of the stage.
  belowTopMenu?: boolean
}) {
  const isMobile = useIsMobile()
  const stackRef = useRef<HTMLDivElement>(null)
  const inspectorRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // `min(180px, its own height)` has no CSS form for a flex item that scrolls,
  // so both floors are measured (`rightStackFloors`).
  useEffect(() => {
    if (isMobile) return
    const stack = stackRef.current
    const slot = inspectorRef.current
    const card = cardRef.current
    if (!(stack && slot && card)) return
    let frame = 0
    const fit = () => {
      frame = 0
      const { natural, header } = inspectorHeights(slot)
      const floors = rightStackFloors({
        naturalHeight: natural,
        headerHeight: header,
        cardHeight: card.scrollHeight,
        stackHeight: stack.clientHeight,
      })
      const inspectorMin = `${floors.inspector}px`
      const cardMin = `${floors.card}px`
      if (slot.style.minHeight !== inspectorMin) slot.style.minHeight = inspectorMin
      if (card.style.minHeight !== cardMin) card.style.minHeight = cardMin
      // The card is click-through; it takes the pointer only when it has to scroll.
      const pointer = floors.card < card.scrollHeight ? 'auto' : ''
      if (card.style.pointerEvents !== pointer) card.style.pointerEvents = pointer
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(fit)
    }
    const resize = new ResizeObserver(schedule)
    resize.observe(stack)
    resize.observe(card)
    // Content growing inside the scroller changes no outer size, hence the mutation watch.
    // The same for the card: a new tool swaps its rows without resizing the slot.
    const mutation = new MutationObserver(schedule)
    for (const target of [slot, card])
      mutation.observe(target, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'hidden', 'aria-expanded'],
        characterData: true,
      })
    fit()
    return () => {
      if (frame) cancelAnimationFrame(frame)
      resize.disconnect()
      mutation.disconnect()
    }
  }, [isMobile])

  if (isMobile) {
    return (
      <>
        <div className="pointer-events-auto">{inspector}</div>
        <div className="pointer-events-auto">{helper}</div>
      </>
    )
  }

  return (
    <RightStackContext.Provider value={true}>
      <div
        className={cn(
          'pointer-events-none fixed right-4 z-40 flex flex-col items-end gap-2',
          reserveBottomMenu ? 'bottom-[74px]' : 'bottom-4',
          !belowTopMenu && 'top-20',
        )}
        style={belowTopMenu ? { top: TOP_MENU_CLEARANCE } : undefined}
        data-right-stack
        ref={stackRef}
      >
        <div className="flex min-h-0 flex-[0_1_auto] flex-col items-end" ref={inspectorRef}>
          {inspector}
        </div>
        <div
          className="no-scrollbar mt-auto flex min-h-0 flex-[0_1_auto] flex-col overflow-y-auto rounded-xl"
          data-right-stack-card
          ref={cardRef}
        >
          {helper}
        </div>
      </div>
    </RightStackContext.Provider>
  )
}

/**
 * The inspector docked as a fixed column beside the stage, as in a desktop CAD: always there, so
 * selecting never covers the drawing. The shortcuts card sits at its foot while nothing is
 * selected (drawing, placing).
 */
export function RightDock({ inspector, helper }: { inspector: ReactNode; helper: ReactNode }) {
  const width = useRightDockWidth((s) => s.width)
  useEffect(() => useRightDockWidth.getState().load(), [])
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)

  // The handle on the left edge: dragging left widens the column.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    drag.current = { startX: e.clientX, startWidth: width }
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    useRightDockWidth
      .getState()
      .setWidth(drag.current.startWidth + drag.current.startX - e.clientX)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    useRightDockWidth.getState().save()
  }

  return (
    <RightStackContext.Provider value={true}>
      <RightDockContext.Provider value={true}>
        <aside
          className="group/dock relative flex h-full shrink-0 flex-col border-border/50 border-l bg-sidebar text-sidebar-foreground"
          data-right-dock
          style={{ width }}
        >
          <div
            aria-label="Trascina per cambiare la larghezza"
            className="-left-3 absolute inset-y-0 z-[100] flex w-6 cursor-col-resize items-center justify-center"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            role="separator"
          >
            <div className="h-8 w-1 rounded-full bg-neutral-500" />
          </div>
          <div className="peer flex min-h-0 flex-1 flex-col empty:hidden">{inspector}</div>
          <div className="hidden flex-1 flex-col items-center justify-center gap-1 px-6 text-center text-muted-foreground text-sm peer-empty:flex">
            <p className="font-medium text-foreground">Nessun elemento selezionato</p>
            <p className="text-xs">
              Clicca un muro, una stanza o un’attrezzatura per vederne e modificarne le
              proprietà qui.
            </p>
          </div>
          {/* The selection's properties need the room more than the select-mode shortcuts. */}
          {helper && (
            <div className="flex shrink-0 flex-col p-3 empty:hidden group-has-[[data-panel-wrapper]]/dock:hidden">
              {helper}
            </div>
          )}
        </aside>
      </RightDockContext.Provider>
    </RightStackContext.Provider>
  )
}
