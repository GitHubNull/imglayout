// 画布交互状态机：平移、缩放（滚轮）、选中、拖动、缩放手柄、旋转手柄。
// 坐标换算全部经 useCanvasView，逻辑坐标一律毫米。
import { snapRectTranslate, snapTargets } from '../../lib/layout/free'
import type { RectMm } from '../../types/layout'
import { useProjectStore } from '../../stores/project'
import type { useCanvasView } from '../../composables/useCanvasView'

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const HANDLE_HIT_PX = 7
const MIN_SIZE_MM = 5

type DragState =
  | { kind: 'pan'; lastX: number; lastY: number }
  | { kind: 'move'; itemId: string; startRect: RectMm; grabDxMm: number; grabDyMm: number; moved: boolean }
  | { kind: 'resize'; itemId: string; handle: HandleId; startRect: RectMm; startXmm: number; startYmm: number; moved: boolean }
  | { kind: 'rotate'; itemId: string; centerXmm: number; centerYmm: number; moved: boolean }
  | null

interface Deps {
  stage: HTMLElement
  view: ReturnType<typeof useCanvasView>
  redraw: () => void
}

export class InteractionController {
  private deps: Deps
  private state: DragState = null
  spaceDown = false
  private onKeyDown: (e: KeyboardEvent) => void
  private onKeyUp: (e: KeyboardEvent) => void

  constructor(deps: Deps) {
    this.deps = deps
    this.onKeyDown = (e) => {
      if (e.code === 'Space') {
        this.spaceDown = true
        e.preventDefault()
      }
    }
    this.onKeyUp = (e) => {
      if (e.code === 'Space') this.spaceDown = false
    }
  }

  attach() {
    const el = this.deps.stage
    el.addEventListener('pointerdown', this.handlePointerDown)
    el.addEventListener('pointermove', this.handlePointerMove)
    el.addEventListener('pointerup', this.handlePointerUp)
    el.addEventListener('pointercancel', this.handlePointerUp)
    el.addEventListener('wheel', this.handleWheel, { passive: false })
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  detach() {
    const el = this.deps.stage
    el.removeEventListener('pointerdown', this.handlePointerDown)
    el.removeEventListener('pointermove', this.handlePointerMove)
    el.removeEventListener('pointerup', this.handlePointerUp)
    el.removeEventListener('pointercancel', this.handlePointerUp)
    el.removeEventListener('wheel', this.handleWheel)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }

  nudgeSelected(dxMm: number, dyMm: number) {
    const project = useProjectStore()
    const item = project.selectedItem
    if (!item || project.doc.mode !== 'free') return
    project.updateItemRect(item.id, { ...item.rect, xMm: item.rect.xMm + dxMm, yMm: item.rect.yMm + dyMm })
    this.deps.redraw()
  }

  deleteSelected() {
    const project = useProjectStore()
    if (project.selectedId) project.removeItem(project.selectedId)
  }

  private bleed(): number {
    return useProjectStore().doc.canvas.bleedMm
  }

  private toMm(e: PointerEvent): { x: number; y: number } {
    const rect = this.deps.stage.getBoundingClientRect()
    const view = this.deps.view
    const b = this.bleed()
    return {
      x: view.mmX(e.clientX - rect.left, b),
      y: view.mmY(e.clientY - rect.top, b),
    }
  }

  private handleAt(pxX: number, pxY: number): { handle: HandleId; item: RectMm; itemId: string } | null {
    const project = useProjectStore()
    if (project.doc.mode !== 'free' || !project.selectedId) return null
    const item = project.selectedItem
    if (!item) return null
    const view = this.deps.view
    const b = this.bleed()
    const cx = view.screenX(item.rect.xMm + item.rect.wMm / 2, b)
    const hx = view.screenX(item.rect.xMm + item.rect.wMm, b)
    const hy = view.screenY(item.rect.yMm + item.rect.hMm, b)
    const lx = view.screenX(item.rect.xMm, b)
    const ly = view.screenY(item.rect.yMm, b)
    const mx = (lx + hx) / 2
    const my = (ly + hy) / 2
    const points: [HandleId, number, number][] = [
      ['nw', lx, ly], ['n', mx, ly], ['ne', hx, ly], ['e', hx, my],
      ['se', hx, hy], ['s', mx, hy], ['sw', lx, hy], ['w', lx, my],
    ]
    for (const [handle, x, y] of points) {
      if (Math.abs(pxX - x) <= HANDLE_HIT_PX && Math.abs(pxY - y) <= HANDLE_HIT_PX) {
        return { handle, item: item.rect, itemId: item.id }
      }
    }
    // 旋转手柄：顶边中点上方 28px
    if (Math.abs(pxX - cx) <= HANDLE_HIT_PX && Math.abs(pxY - (ly - 28)) <= HANDLE_HIT_PX) {
      return { handle: 'n', item: item.rect, itemId: item.id }
    }
    return null
  }

  private itemAt(mmX: number, mmY: number): string | null {
    const project = useProjectStore()
    const rects = project.rects
    for (let i = project.doc.items.length - 1; i >= 0; i--) {
      const item = project.doc.items[i]
      const rect = rects[i]
      if (!rect) continue
      const cx = rect.xMm + rect.wMm / 2
      const cy = rect.yMm + rect.hMm / 2
      const rad = (-(item.rotation % 360) * Math.PI) / 180
      const dx = mmX - cx
      const dy = mmY - cy
      const rx = dx * Math.cos(rad) - dy * Math.sin(rad) + cx
      const ry = dx * Math.sin(rad) + dy * Math.cos(rad) + cy
      if (rx >= rect.xMm && rx <= rect.xMm + rect.wMm && ry >= rect.yMm && ry <= rect.yMm + rect.hMm) {
        return item.id
      }
    }
    return null
  }

  private handlePointerDown = (e: PointerEvent) => {
    const el = this.deps.stage
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    const pxX = e.clientX - rect.left
    const pxY = e.clientY - rect.top
    const project = useProjectStore()

    if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
      this.state = { kind: 'pan', lastX: e.clientX, lastY: e.clientY }
      e.preventDefault()
      return
    }
    if (e.button !== 0) return

    const hit = this.handleAt(pxX, pxY)
    if (hit && project.doc.mode === 'free') {
      const mm = this.toMm(e)
      if (this.isRotateHandle(pxX, pxY)) {
        const item = project.selectedItem!
        this.state = {
          kind: 'rotate',
          itemId: hit.itemId,
          centerXmm: item.rect.xMm + item.rect.wMm / 2,
          centerYmm: item.rect.yMm + item.rect.hMm / 2,
          moved: false,
        }
      } else {
        this.state = {
          kind: 'resize',
          itemId: hit.itemId,
          handle: hit.handle,
          startRect: { ...hit.item },
          startXmm: mm.x,
          startYmm: mm.y,
          moved: false,
        }
      }
      return
    }

    const mm = this.toMm(e)
    const itemId = this.itemAt(mm.x, mm.y)
    project.select(itemId)
    if (itemId && project.doc.mode === 'free') {
      const item = project.doc.items.find((i) => i.id === itemId)!
      this.state = {
        kind: 'move',
        itemId,
        startRect: { ...item.rect },
        grabDxMm: mm.x - item.rect.xMm,
        grabDyMm: mm.y - item.rect.yMm,
        moved: false,
      }
    }
    this.deps.redraw()
  }

  private isRotateHandle(pxX: number, pxY: number): boolean {
    const project = useProjectStore()
    const item = project.selectedItem
    if (!item) return false
    const view = this.deps.view
    const b = this.bleed()
    const cx = view.screenX(item.rect.xMm + item.rect.wMm / 2, b)
    const ly = view.screenY(item.rect.yMm, b)
    return Math.abs(pxX - cx) <= HANDLE_HIT_PX && Math.abs(pxY - (ly - 28)) <= HANDLE_HIT_PX
  }

  private handlePointerMove = (e: PointerEvent) => {
    const state = this.state
    if (!state) return
    const project = useProjectStore()
    const mm = this.toMm(e)

    if (state.kind === 'pan') {
      this.deps.view.panBy(e.clientX - state.lastX, e.clientY - state.lastY)
      state.lastX = e.clientX
      state.lastY = e.clientY
    } else if (state.kind === 'move') {
      const draft: RectMm = {
        ...state.startRect,
        xMm: mm.x - state.grabDxMm,
        yMm: mm.y - state.grabDyMm,
      }
      const others = project.doc.items
        .filter((i) => i.id !== state.itemId)
        .map((i) => i.rect)
      const snapped = snapRectTranslate(draft, snapTargets(project.doc.canvas, others), snapTargets(project.doc.canvas, others))
      project.updateItemRect(state.itemId, snapped)
      state.moved = true
    } else if (state.kind === 'resize') {
      project.updateItemRect(state.itemId, this.resizedRect(state, mm.x, mm.y))
      state.moved = true
    } else if (state.kind === 'rotate') {
      const deg = (Math.atan2(mm.y - state.centerYmm, mm.x - state.centerXmm) * 180) / Math.PI
      const rotation = (deg + 90 + 360) % 360
      project.updateItem(state.itemId, { rotation: Math.round(rotation) })
      state.moved = true
    }
    this.deps.redraw()
  }

  private resizedRect(
    state: { handle: HandleId; startRect: RectMm; startXmm: number; startYmm: number },
    mmX: number,
    mmY: number,
  ): RectMm {
    const dx = mmX - state.startXmm
    const dy = mmY - state.startYmm
    const r = state.startRect
    let { xMm: x, yMm: y, wMm: w, hMm: h } = r
    const handle = state.handle
    if (handle.includes('e')) w = r.wMm + dx
    if (handle.includes('w')) w = r.wMm - dx
    if (handle.includes('s')) h = r.hMm + dy
    if (handle.includes('n')) h = r.hMm - dy
    w = Math.max(MIN_SIZE_MM, w)
    h = Math.max(MIN_SIZE_MM, h)
    if (handle.includes('w')) x = r.xMm + r.wMm - w
    if (handle.includes('n')) y = r.yMm + r.hMm - h
    if (handle === 'n' || handle === 's') {
      x = r.xMm
      w = r.wMm
    }
    if (handle === 'e' || handle === 'w') {
      y = r.yMm
      h = r.hMm
    }
    return { xMm: x, yMm: y, wMm: w, hMm: h }
  }

  private handlePointerUp = () => {
    if (this.state && 'moved' in this.state && this.state.moved) {
      useProjectStore().snapshot()
    }
    this.state = null
  }

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const rect = this.deps.stage.getBoundingClientRect()
    const pxX = e.clientX - rect.left
    const pxY = e.clientY - rect.top
    if (e.shiftKey) {
      this.deps.view.panBy(-e.deltaY, 0)
    } else {
      const factor = Math.exp(-e.deltaY * 0.0015)
      this.deps.view.zoomAt(pxX, pxY, factor)
    }
    this.deps.redraw()
  }
}
