// 画布交互状态机：平移（中键/右键/空格+左键）、缩放（滚轮）、单选/多选、
// 框选、拖动（含组合联动）、缩放手柄、旋转手柄、吸附（边缘 + 网格）。
// 坐标换算全部经 useCanvasView，逻辑坐标一律毫米。
import {
  snapGridTranslate,
  snapHitLines,
  snapRectTranslate,
  snapTargets,
  SNAP_TOLERANCE_PX,
} from '../../lib/layout/free'
import type { RectMm } from '../../types/layout'
import { useProjectStore } from '../../stores/project'
import { useSettingsStore } from '../../stores/settings'
import type { useCanvasView } from '../../composables/useCanvasView'

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const HANDLE_HIT_PX = 7
const MIN_SIZE_MM = 5

type DragState =
  | { kind: 'pan'; lastX: number; lastY: number }
  | {
      kind: 'move'
      itemId: string
      startRect: RectMm
      /** 联动移动的成员（同组 + 其余选中项），不含主拖动项 */
      groupRects: { id: string; rect: RectMm }[]
      grabDxMm: number
      grabDyMm: number
      moved: boolean
    }
  | { kind: 'resize'; itemId: string; handle: HandleId; startRect: RectMm; startXmm: number; startYmm: number; moved: boolean }
  | { kind: 'rotate'; itemId: string; centerXmm: number; centerYmm: number; moved: boolean }
  | { kind: 'marquee'; startXmm: number; startYmm: number; curXmm: number; curYmm: number }
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
  /** 拖动吸附命中目标处的对齐提示线（smart guides）：v=竖线 x 值，h=横线 y 值 */
  alignLines: { v: number[]; h: number[] } | null = null
  private onKeyDown: (e: KeyboardEvent) => void
  private onKeyUp: (e: KeyboardEvent) => void

  constructor(deps: Deps) {
    this.deps = deps
    this.onKeyDown = (e) => {
      if (e.code === 'Space') {
        this.spaceDown = true
        if (this.state?.kind !== 'pan') deps.stage.style.cursor = 'grab'
        e.preventDefault()
      }
    }
    this.onKeyUp = (e) => {
      if (e.code === 'Space') {
        this.spaceDown = false
        if (this.state?.kind !== 'pan') deps.stage.style.cursor = ''
      }
    }
  }

  attach() {
    const el = this.deps.stage
    el.addEventListener('pointerdown', this.handlePointerDown)
    el.addEventListener('pointermove', this.handlePointerMove)
    el.addEventListener('pointerup', this.handlePointerUp)
    el.addEventListener('pointercancel', this.handlePointerUp)
    el.addEventListener('wheel', this.handleWheel, { passive: false })
    el.addEventListener('contextmenu', this.handleContextMenu)
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
    el.removeEventListener('contextmenu', this.handleContextMenu)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }

  /** 框选矩形（毫米，已归一化）；未在框选时返回 null */
  get marqueeRect(): RectMm | null {
    if (this.state?.kind !== 'marquee') return null
    const { startXmm, startYmm, curXmm, curYmm } = this.state
    return {
      xMm: Math.min(startXmm, curXmm),
      yMm: Math.min(startYmm, curYmm),
      wMm: Math.abs(curXmm - startXmm),
      hMm: Math.abs(curYmm - startYmm),
    }
  }

  nudgeSelected(dxMm: number, dyMm: number) {
    const project = useProjectStore()
    if (project.doc.mode !== 'free') return
    for (const item of project.selectedItems) {
      if (item.locked) continue
      project.updateItemRect(item.id, {
        ...item.rect,
        xMm: item.rect.xMm + dxMm,
        yMm: item.rect.yMm + dyMm,
      })
    }
    this.deps.redraw()
  }

  deleteSelected() {
    const project = useProjectStore()
    const ids = project.selectedItems.filter((i) => !i.locked).map((i) => i.id)
    if (ids.length) project.removeItems(ids)
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
    const item = project.selectedItem
    if (project.doc.mode !== 'free' || !item) return null
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
      if (!rect || !item.visible) continue
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

  private handleContextMenu = (e: Event) => {
    // 右键留给画布平移，屏蔽系统菜单
    e.preventDefault()
  }

  private handlePointerDown = (e: PointerEvent) => {
    const el = this.deps.stage
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    const pxX = e.clientX - rect.left
    const pxY = e.clientY - rect.top
    const project = useProjectStore()

    if (e.button === 1 || e.button === 2 || (e.button === 0 && this.spaceDown)) {
      this.state = { kind: 'pan', lastX: e.clientX, lastY: e.clientY }
      el.style.cursor = 'grabbing'
      e.preventDefault()
      return
    }
    if (e.button !== 0) return

    const hit = this.handleAt(pxX, pxY)
    if (hit && project.doc.mode === 'free' && !project.selectedItem?.locked) {
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

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      if (itemId) project.toggleSelect(itemId)
      this.deps.redraw()
      return
    }

    if (itemId && project.selectedIds.includes(itemId) && project.selectedIds.length > 1) {
      // 点在已多选的成员上：保持选择，拖动整组
      this.startMove(project, itemId, mm)
      this.deps.redraw()
      return
    }

    project.select(itemId)
    if (itemId && project.doc.mode === 'free') {
      const item = project.doc.items.find((i) => i.id === itemId)!
      if (item.locked) {
        this.deps.redraw()
        return
      }
      this.startMove(project, itemId, mm)
    } else if (!itemId) {
      this.state = { kind: 'marquee', startXmm: mm.x, startYmm: mm.y, curXmm: mm.x, curYmm: mm.y }
    }
    this.deps.redraw()
  }

  private startMove(
    project: ReturnType<typeof useProjectStore>,
    itemId: string,
    mm: { x: number; y: number },
  ) {
    const item = project.doc.items.find((i) => i.id === itemId)!
    const selected = new Set(project.selectedIds)
    const gid = item.groupId
    // 联动成员：同组合的其他未锁定成员 + 其余已选中未锁定项
    const groupRects = project.doc.items
      .filter(
        (i) =>
          i.id !== itemId &&
          !i.locked &&
          ((gid != null && i.groupId === gid) || selected.has(i.id)),
      )
      .map((i) => ({ id: i.id, rect: { ...i.rect } }))
    this.state = {
      kind: 'move',
      itemId,
      startRect: { ...item.rect },
      groupRects,
      grabDxMm: mm.x - item.rect.xMm,
      grabDyMm: mm.y - item.rect.yMm,
      moved: false,
    }
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
    } else if (state.kind === 'marquee') {
      state.curXmm = mm.x
      state.curYmm = mm.y
    } else if (state.kind === 'move') {
      const draft: RectMm = {
        ...state.startRect,
        xMm: mm.x - state.grabDxMm,
        yMm: mm.y - state.grabDyMm,
      }
      const settings = useSettingsStore()
      const movingIds = new Set([
        state.itemId,
        ...state.groupRects.map((g) => g.id),
      ])
      let snapped = draft
      // 像素制动态容差：5px 换算毫米，缩放越小容差越大（PS 口径）
      const tolMm = SNAP_TOLERANCE_PX / this.deps.view.pxPerMm.value
      if (settings.edgeSnap) {
        const others = project.doc.items
          .filter((i) => !movingIds.has(i.id))
          .map((i) => i.rect)
        const base = snapTargets(project.doc.canvas, others)
        // 参考线隐藏时不参与吸附（与 PS 口径一致）
        const guides = settings.guidesVisible ? (project.doc.guides ?? []) : []
        const gx = guides.filter((g) => g.axis === 'x').map((g) => g.posMm)
        const gy = guides.filter((g) => g.axis === 'y').map((g) => g.posMm)
        const targetsX = [...base, ...gx]
        const targetsY = [...base, ...gy]
        snapped = snapRectTranslate(draft, targetsX, targetsY, tolMm)
        const hits = snapHitLines(snapped, targetsX, targetsY)
        this.alignLines = { v: hits.x, h: hits.y }
      } else {
        this.alignLines = null
      }
      if (settings.gridSnap) {
        const grid = snapGridTranslate(snapped, settings.gridStepMm)
        // 两路吸附逐轴取更近者；边缘路未命中（delta 恒 ≤ 容差，> 容差即未命中）或整体关闭时网格路兜底
        const noHitX = !settings.edgeSnap || Math.abs(snapped.xMm - draft.xMm) > tolMm
        const noHitY = !settings.edgeSnap || Math.abs(snapped.yMm - draft.yMm) > tolMm
        snapped = {
          ...snapped,
          xMm: noHitX || Math.abs(grid.xMm - draft.xMm) < Math.abs(snapped.xMm - draft.xMm) ? grid.xMm : snapped.xMm,
          yMm: noHitY || Math.abs(grid.yMm - draft.yMm) < Math.abs(snapped.yMm - draft.yMm) ? grid.yMm : snapped.yMm,
        }
      }
      const dx = snapped.xMm - state.startRect.xMm
      const dy = snapped.yMm - state.startRect.yMm
      project.updateItemRect(state.itemId, snapped)
      for (const g of state.groupRects) {
        project.updateItemRect(g.id, { ...g.rect, xMm: g.rect.xMm + dx, yMm: g.rect.yMm + dy })
      }
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

  private handlePointerUp = (e: PointerEvent) => {
    const state = this.state
    if (state?.kind === 'pan') {
      this.deps.stage.style.cursor = this.spaceDown ? 'grab' : ''
    } else if (state?.kind === 'marquee') {
      const project = useProjectStore()
      const { startXmm, startYmm, curXmm, curYmm } = state
      const x0 = Math.min(startXmm, curXmm)
      const y0 = Math.min(startYmm, curYmm)
      const x1 = Math.max(startXmm, curXmm)
      const y1 = Math.max(startYmm, curYmm)
      const rects = project.rects
      const hit: string[] = []
      project.doc.items.forEach((item, i) => {
        const r = rects[i]
        if (!r || !item.visible) return
        const cx = r.xMm + r.wMm / 2
        const cy = r.yMm + r.hMm / 2
        if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) hit.push(item.id)
      })
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        for (const id of hit) {
          if (!project.selectedIds.includes(id)) project.selectedIds.push(id)
        }
      } else {
        project.selectedIds = hit
      }
    }
    if (state && 'moved' in state && state.moved) {
      useProjectStore().snapshot()
    }
    this.alignLines = null
    this.state = null
    this.deps.redraw()
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
