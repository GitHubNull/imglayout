// 参考线交互：标尺拖出/拖动/拖回删除、点选/Shift 多选、悬停高亮、双击精确编辑。
// 仅自由排版模式生效；挂在 stage 上且先于 InteractionController attach，
// 命中标尺带/参考线时 stopImmediatePropagation 拦截，本体不感知参考线。
import type { useCanvasView } from '../../composables/useCanvasView'
import type { Guide, GuideAxis } from '../../types/layout'
import { useProjectStore } from '../../stores/project'
import { useSettingsStore } from '../../stores/settings'
import { RULER_BAND_PX } from '../../lib/ruler'
import type { GuideDraft } from './drawGuides'

/** 参考线命中阈值（屏幕像素） */
export const GUIDE_HIT_PX = 5

type DragState =
  | { kind: 'create'; axis: GuideAxis; posMm: number }
  | { kind: 'drag'; id: string; axis: GuideAxis; moved: boolean }
  | null

export interface GuideEditRequest {
  id: string
  axis: GuideAxis
  posMm: number
  /** 浮层定位（stage 内屏幕坐标） */
  left: number
  top: number
}

interface Deps {
  stage: HTMLElement
  view: ReturnType<typeof useCanvasView>
  redraw: () => void
  onEdit: (req: GuideEditRequest) => void
}

export class GuidesController {
  private deps: Deps
  private state: DragState = null
  /** 拖出中的参考线草稿（绘制层读取） */
  draft: GuideDraft | null = null
  hoveredId: string | null = null

  constructor(deps: Deps) {
    this.deps = deps
  }

  attach() {
    const el = this.deps.stage
    el.addEventListener('pointerdown', this.handlePointerDown)
    el.addEventListener('pointermove', this.handlePointerMove)
    el.addEventListener('pointerup', this.handlePointerUp)
    el.addEventListener('pointercancel', this.handlePointerUp)
    el.addEventListener('dblclick', this.handleDblClick)
  }

  detach() {
    const el = this.deps.stage
    el.removeEventListener('pointerdown', this.handlePointerDown)
    el.removeEventListener('pointermove', this.handlePointerMove)
    el.removeEventListener('pointerup', this.handlePointerUp)
    el.removeEventListener('pointercancel', this.handlePointerUp)
    el.removeEventListener('dblclick', this.handleDblClick)
  }

  private active(): boolean {
    const project = useProjectStore()
    const settings = useSettingsStore()
    return (
      project.doc.mode === 'free' && settings.rulerVisible && settings.guidesVisible
    )
  }

  private toPx(e: PointerEvent | MouseEvent): { pxX: number; pxY: number } {
    const rect = this.deps.stage.getBoundingClientRect()
    return { pxX: e.clientX - rect.left, pxY: e.clientY - rect.top }
  }

  private toMm(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const { pxX, pxY } = this.toPx(e)
    const view = this.deps.view
    const b = useProjectStore().doc.canvas.bleedMm
    return { x: view.mmX(pxX, b), y: view.mmY(pxY, b) }
  }

  private guideAt(pxX: number, pxY: number): Guide | null {
    const project = useProjectStore()
    const view = this.deps.view
    const b = project.doc.canvas.bleedMm
    for (let i = (project.doc.guides ?? []).length - 1; i >= 0; i--) {
      const g = project.doc.guides![i]
      const onLine =
        g.axis === 'x'
          ? Math.abs(view.screenX(g.posMm, b) - pxX) <= GUIDE_HIT_PX
          : Math.abs(view.screenY(g.posMm, b) - pxY) <= GUIDE_HIT_PX
      if (onLine) return g
    }
    return null
  }

  private inRulerBand(axis: GuideAxis, pxX: number, pxY: number): boolean {
    const h = this.deps.stage.clientHeight
    return axis === 'x' ? pxX <= RULER_BAND_PX : pxY >= h - RULER_BAND_PX
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (!this.active() || e.button !== 0) return
    const project = useProjectStore()
    const { pxX, pxY } = this.toPx(e)
    const el = this.deps.stage

    if (pxX <= RULER_BAND_PX) {
      this.state = { kind: 'create', axis: 'x', posMm: this.toMm(e).x }
    } else if (pxY >= el.clientHeight - RULER_BAND_PX) {
      this.state = { kind: 'create', axis: 'y', posMm: this.toMm(e).y }
    } else {
      const hit = this.guideAt(pxX, pxY)
      if (!hit) {
        if (!e.shiftKey) project.clearGuideSelection()
        return
      }
      if (e.shiftKey) {
        project.toggleGuideSelect(hit.id)
      } else if (project.selectedGuideIds.length !== 1 || project.selectedGuideIds[0] !== hit.id) {
        project.selectGuide(hit.id)
      }
      if (!hit.locked) {
        this.state = { kind: 'drag', id: hit.id, axis: hit.axis, moved: false }
      }
    }
    el.setPointerCapture(e.pointerId)
    e.stopImmediatePropagation()
    this.syncDraft()
    this.deps.redraw()
  }

  private handlePointerMove = (e: PointerEvent) => {
    const state = this.state
    if (!state) {
      if (!this.active()) return
      const { pxX, pxY } = this.toPx(e)
      const hit = this.guideAt(pxX, pxY)
      this.hoveredId = hit?.id ?? null
      this.deps.stage.style.cursor =
        hit == null ? '' : hit.axis === 'x' ? 'col-resize' : 'row-resize'
      this.deps.redraw()
      return
    }
    const mm = this.toMm(e)
    if (state.kind === 'create') {
      state.posMm = state.axis === 'x' ? mm.x : mm.y
    } else {
      useProjectStore().updateGuidePos(state.id, state.axis === 'x' ? mm.x : mm.y)
      state.moved = true
    }
    this.syncDraft()
    this.deps.redraw()
  }

  private handlePointerUp = (e: PointerEvent) => {
    const state = this.state
    if (!state) return
    const project = useProjectStore()
    const { pxX, pxY } = this.toPx(e)
    if (state.kind === 'create') {
      // 指针仍留在标尺带内 = 误拖，丢弃；否则落定
      if (!this.inRulerBand(state.axis, pxX, pxY)) {
        project.addGuide({
          id: crypto.randomUUID(),
          axis: state.axis,
          posMm: state.posMm,
        })
      }
    } else {
      // 拖回标尺带 = 删除
      if (this.inRulerBand(state.axis, pxX, pxY)) {
        project.removeGuides([state.id])
      } else if (state.moved) {
        project.snapshot()
      }
    }
    this.state = null
    this.draft = null
    this.deps.redraw()
  }

  private handleDblClick = (e: MouseEvent) => {
    if (!this.active()) return
    const { pxX, pxY } = this.toPx(e)
    const hit = this.guideAt(pxX, pxY)
    if (!hit) return
    e.stopImmediatePropagation()
    this.deps.onEdit({ id: hit.id, axis: hit.axis, posMm: hit.posMm, left: pxX, top: pxY })
  }

  private syncDraft() {
    this.draft = this.state?.kind === 'create' ? this.state : null
  }
}
