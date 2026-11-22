<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCanvasView } from '../../composables/useCanvasView'
import { fillOf } from '../../stores/project'
import { useProjectStore } from '../../stores/project'
import { setAssetImageListener, useAssetsStore } from '../../stores/assets'
import { InteractionController, HANDLES } from './InteractionController'
import { useStageResize } from '../../composables/useStageResize'
import { GuidesController, type GuideEditRequest } from './GuidesController'
import { drawGuides } from './drawGuides'
import { useSettingsStore } from '../../stores/settings'
import { drawRulers } from '../../lib/ruler'
import { canvasPalette, LIGHT_PALETTE, type CanvasPalette } from '../../lib/canvasTheme'
import type { PhotoItem, RectMm } from '../../types/layout'

const stageEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

const props = defineProps<{ view: ReturnType<typeof useCanvasView> }>()

const project = useProjectStore()
const assets = useAssetsStore()
const settings = useSettingsStore()
// view 由 EditorView 创建并共享，工具栏的缩放读数与画布联动
const view = props.view

let ctx: CanvasRenderingContext2D | null = null
let pal: CanvasPalette = LIGHT_PALETTE
let controller: InteractionController | null = null
let guidesCtl: GuidesController | null = null
let stageResize: ReturnType<typeof useStageResize> | null = null
let rafPending = false

function scheduleDraw() {
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => {
    rafPending = false
    draw()
  })
}

function outSizeMm(): { w: number; h: number } {
  const c = project.doc.canvas
  return { w: c.widthMm + 2 * c.bleedMm, h: c.heightMm + 2 * c.bleedMm }
}

function fitView() {
  const el = stageEl.value
  if (!el || el.clientWidth === 0 || el.clientHeight === 0) return
  const { w, h } = outSizeMm()
  view.fit(el.clientWidth, el.clientHeight, w, h)
}

defineExpose({ fitView, zoomStep: (f: number) => {
  const el = stageEl.value
  if (!el) return
  view.zoomTo(el.clientWidth, el.clientHeight, view.pxPerMm.value * f)
  scheduleDraw()
}, zoom100: () => {
  const el = stageEl.value
  if (!el) return
  view.zoomTo(el.clientWidth, el.clientHeight, view.PX_PER_MM_AT_100)
  scheduleDraw()
} })

function roundedRectPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx!.beginPath()
  ctx!.moveTo(x + rr, y)
  ctx!.arcTo(x + w, y, x + w, y + h, rr)
  ctx!.arcTo(x + w, y + h, x, y + h, rr)
  ctx!.arcTo(x, y + h, x, y, rr)
  ctx!.arcTo(x, y, x + w, y, rr)
  ctx!.closePath()
}

function drawItem(item: PhotoItem, rect: RectMm) {
  const c = project.doc.canvas
  const img = assets.image(item.assetId)
  const s = view.pxPerMm.value
  const dx = view.screenX(rect.xMm, c.bleedMm)
  const dy = view.screenY(rect.yMm, c.bleedMm)
  const dw = rect.wMm * s
  const dh = rect.hMm * s
  if (dw <= 0 || dh <= 0) return

  const radiusPx = item.style.radiusMm * s
  const borderPx = item.style.borderWidthMm * s
  const fill = fillOf(project.doc)

  ctx!.save()
  ctx!.globalAlpha = Math.min(1, Math.max(0, item.opacity))
  roundedRectPath(dx, dy, dw, dh, radiusPx)
  ctx!.clip()

  if (item.rotation % 360 !== 0) {
    ctx!.translate(dx + dw / 2, dy + dh / 2)
    ctx!.rotate((item.rotation * Math.PI) / 180)
    ctx!.translate(-(dx + dw / 2), -(dy + dh / 2))
  }
  // 翻转：变换顺序为 rotate∘flip（先调用旋转后调用 scale），与导出「先翻转后旋转」一致
  if (item.flipH || item.flipV) {
    ctx!.translate(dx + dw / 2, dy + dh / 2)
    ctx!.scale(item.flipH ? -1 : 1, item.flipV ? -1 : 1)
    ctx!.translate(-(dx + dw / 2), -(dy + dh / 2))
  }

  // contain：格内留白填画布背景色
  if (fill === 'contain') {
    ctx!.fillStyle = c.background
    ctx!.fillRect(dx - radiusPx, dy - radiusPx, dw + radiusPx * 2, dh + radiusPx * 2)
  }

  if (img && img.complete && img.naturalWidth > 0) {
    // crop：先取归一化裁剪窗口，再在窗口内做 cover/contain 取样（导出口径：窗口作用于翻转后的整图）
    let sx = 0
    let sy = 0
    let sw = img.naturalWidth
    let sh = img.naturalHeight
    if (item.crop) {
      sx = item.crop.x * sw
      sy = item.crop.y * sh
      sw *= item.crop.w
      sh *= item.crop.h
    }
    const boxAspect = dw / dh
    const srcAspect = sw / sh
    let destX = dx
    let destY = dy
    let destW = dw
    let destH = dh
    if (fill === 'cover') {
      if (srcAspect > boxAspect) {
        const w = sh * boxAspect
        sx += (sw - w) / 2
        sw = w
      } else {
        const h = sw / boxAspect
        sy += (sh - h) / 2
        sh = h
      }
    } else {
      const scale = Math.min(dw / sw, dh / sh)
      destW = sw * scale
      destH = sh * scale
      destX = dx + (dw - destW) / 2
      destY = dy + (dh - destH) / 2
    }
    // 亮度/对比度/饱和度：CSS filter 与导出 apply_adjust 对齐（WebView 不支持时静默忽略）
    const a = item.adjust
    ctx!.filter = `brightness(${a.brightness}) contrast(${a.contrast}) saturate(${a.saturation})`
    ctx!.drawImage(img, sx, sy, sw, sh, destX, destY, destW, destH)
  } else {
    // 缩略图未就绪：占位灰
    ctx!.fillStyle = pal.thumbPlaceholder
    ctx!.fillRect(dx, dy, dw, dh)
  }
  ctx!.restore()

  if (borderPx > 0) {
    ctx!.save()
    ctx!.globalAlpha = Math.min(1, Math.max(0, item.opacity))
    roundedRectPath(dx + borderPx / 2, dy + borderPx / 2, dw - borderPx, dh - borderPx, Math.max(0, radiusPx - borderPx / 2))
    ctx!.strokeStyle = item.style.borderColor
    ctx!.lineWidth = borderPx
    ctx!.stroke()
    ctx!.restore()
  }

  if (item.id === project.selectedItem?.id) {
    drawSelection(rect, true)
  } else if (project.selectedIds.includes(item.id)) {
    drawSelection(rect, false)
  }
}

function drawSelection(rect: RectMm, primary: boolean) {
  const c = project.doc.canvas
  const s = view.pxPerMm.value
  const dx = view.screenX(rect.xMm, c.bleedMm)
  const dy = view.screenY(rect.yMm, c.bleedMm)
  const dw = rect.wMm * s
  const dh = rect.hMm * s
  ctx!.save()
  ctx!.strokeStyle = primary ? pal.selPrimary : pal.selSecondary
  ctx!.lineWidth = primary ? 1.5 : 1
  ctx!.setLineDash([4, 3])
  ctx!.strokeRect(dx, dy, dw, dh)
  ctx!.setLineDash([])
  if (primary && project.doc.mode === 'free') {
    ctx!.fillStyle = pal.handleFill
    ctx!.strokeStyle = pal.selPrimary
    for (const hx of [dx, dx + dw / 2, dx + dw]) {
      for (const hy of [dy, dy + dh / 2, dy + dh]) {
        const isRotate = hx === dx + dw / 2 && hy === dy
        if (isRotate) continue
        ctx!.fillRect(hx - 4, hy - 4, 8, 8)
        ctx!.strokeRect(hx - 4, hy - 4, 8, 8)
      }
    }
    void HANDLES
    // 旋转手柄
    const cx = dx + dw / 2
    ctx!.beginPath()
    ctx!.arc(cx, dy - 28, 6, 0, Math.PI * 2)
    ctx!.fill()
    ctx!.stroke()
    ctx!.beginPath()
    ctx!.moveTo(cx, dy - 22)
    ctx!.lineTo(cx, dy)
    ctx!.stroke()
  }
  ctx!.restore()
}

function draw() {
  const canvas = canvasEl.value
  const el = stageEl.value
  if (!canvas || !el || !ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = el.clientWidth
  const h = el.clientHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  pal = canvasPalette(settings.theme)
  // 工作台
  ctx.fillStyle = pal.workbenchBg
  ctx.fillRect(0, 0, w, h)

  const c = project.doc.canvas
  const { w: outW, h: outH } = outSizeMm()
  const s = view.pxPerMm.value
  const ox = view.originX.value
  const oy = view.originY.value

  // 输出画布（含出血）
  ctx.fillStyle = /^#[0-9A-Fa-f]{3,8}$/.test(c.background) ? c.background : '#FFFFFF'
  ctx.fillRect(ox, oy, outW * s, outH * s)
  ctx.strokeStyle = pal.outStroke
  ctx.lineWidth = 1
  ctx.strokeRect(ox - 0.5, oy - 0.5, outW * s + 1, outH * s + 1)

  // 成品裁切线（出血内沿，虚线）
  if (c.bleedMm > 0) {
    const bx = c.bleedMm * s
    ctx.save()
    ctx.strokeStyle = pal.cropLine
    ctx.setLineDash([6, 4])
    ctx.strokeRect(ox + bx, oy + bx, c.widthMm * s, c.heightMm * s)
    ctx.restore()
  }

  const rects = project.rects
  project.doc.items.forEach((item, i) => {
    const rect = rects[i]
    if (item.visible && rect) drawItem(item, rect)
  })

  drawGrid()
  drawGuidesLayer()
  drawAlignLines()
  drawMarquee()
  if (settings.rulerVisible) drawRulers(ctx, view, w, h, c, pal.ruler)
}

/** 参考线：仅自由排版且开启显示时绘制 */
function drawGuidesLayer() {
  if (!ctx || project.doc.mode !== 'free' || !settings.guidesVisible) return
  drawGuides(ctx, view, project.doc.canvas, {
    guides: project.doc.guides ?? [],
    selectedIds: project.selectedGuideIds,
    hoveredId: guidesCtl?.hoveredId ?? null,
    draft: guidesCtl?.draft ?? null,
    draggingId: guidesCtl?.draggingId ?? null,
    draftSnapped: guidesCtl?.draftSnapped ?? false,
  }, pal.guides)
}

/** 自由布局网格：按 settings.gridStepMm 画线，屏幕间距过密时自动跳档 */
function drawGrid() {
  if (project.doc.mode !== 'free' || !settings.gridVisible || !ctx) return
  const c = project.doc.canvas
  const s = view.pxPerMm.value
  let step = settings.gridStepMm
  while (step * s < 8 && step < 100) {
    step = step >= 10 ? step + 10 : step === 5 ? 10 : step === 2 ? 5 : 2
  }
  const b = c.bleedMm
  const x0 = view.screenX(-b, b)
  const y0 = view.screenY(-b, b)
  const x1 = view.screenX(c.widthMm + b, b)
  const y1 = view.screenY(c.heightMm + b, b)
  ctx.save()
  ctx.beginPath()
  for (let v = Math.ceil(-b / step) * step; v <= c.widthMm + b + 1e-6; v += step) {
    const x = view.screenX(v, b)
    ctx.moveTo(x, y0)
    ctx.lineTo(x, y1)
  }
  for (let v = Math.ceil(-b / step) * step; v <= c.heightMm + b + 1e-6; v += step) {
    const y = view.screenY(v, b)
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
  }
  ctx.strokeStyle = pal.gridLine
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

/** 拖动对齐提示线（PS smart guides 语义）：吸附命中的目标轴线画品红贯穿线 */
function drawAlignLines() {
  const lines = controller?.alignLines
  if (!lines || !ctx) return
  const c = project.doc.canvas
  const b = c.bleedMm
  const x0 = view.screenX(-b, b)
  const x1 = view.screenX(c.widthMm + b, b)
  const y0 = view.screenY(-b, b)
  const y1 = view.screenY(c.heightMm + b, b)
  ctx.save()
  ctx.strokeStyle = pal.alignLine
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const v of lines.v) {
    const x = Math.round(view.screenX(v, b)) + 0.5
    ctx.moveTo(x, y0)
    ctx.lineTo(x, y1)
  }
  for (const v of lines.h) {
    const y = Math.round(view.screenY(v, b)) + 0.5
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
  }
  ctx.stroke()
  ctx.restore()
}

function drawMarquee() {
  const mq = controller?.marqueeRect
  if (!mq || !ctx) return
  const c = project.doc.canvas
  const dx = view.screenX(mq.xMm, c.bleedMm)
  const dy = view.screenY(mq.yMm, c.bleedMm)
  ctx.save()
  ctx.strokeStyle = pal.marqueeStroke
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])
  ctx.strokeRect(dx, dy, mq.wMm * view.pxPerMm.value, mq.hMm * view.pxPerMm.value)
  ctx.fillStyle = pal.marqueeFill
  ctx.fillRect(dx, dy, mq.wMm * view.pxPerMm.value, mq.hMm * view.pxPerMm.value)
  ctx.restore()
}

/** 全局「取消选择」命令（Escape）派发的清理：关闭参考线精确编辑弹层 */
function onEditorEscape() {
  guideEdit.value = null
  scheduleDraw()
}

interface GuideEditState {
  id: string
  axis: 'x' | 'y'
  /** 标尺口径毫米值（y 线 = heightMm − posMm），与标尺读数一致 */
  value: number | null
  locked: boolean
  left: number
  top: number
}
const guideEdit = ref<GuideEditState | null>(null)

function openGuideEdit(req: GuideEditRequest) {
  const el = stageEl.value
  if (!el) return
  const c = project.doc.canvas
  const shown = req.axis === 'x' ? req.posMm : c.heightMm - req.posMm
  const max = req.axis === 'x' ? c.widthMm : c.heightMm
  guideEdit.value = {
    id: req.id,
    axis: req.axis,
    value: Math.round(Math.min(max, Math.max(0, shown)) * 10) / 10,
    locked: !!project.doc.guides?.find((g) => g.id === req.id)?.locked,
    left: Math.min(Math.max(req.left, 90), el.clientWidth - 90),
    top: Math.min(Math.max(req.top, 44), el.clientHeight - 44),
  }
}

function commitGuideEdit() {
  const ge = guideEdit.value
  if (!ge || ge.value == null) return
  const c = project.doc.canvas
  const max = ge.axis === 'x' ? c.widthMm : c.heightMm
  const shown = Math.min(max, Math.max(0, ge.value))
  const posMm = ge.axis === 'x' ? shown : c.heightMm - shown
  const guide = project.doc.guides?.find((g) => g.id === ge.id)
  if (!guide) {
    guideEdit.value = null
    return
  }
  const lockChanged = !!guide.locked !== ge.locked
  const posChanged = Math.abs(guide.posMm - posMm) > 1e-9
  if (lockChanged) project.setGuideLocked(ge.id, ge.locked)
  else if (posChanged) project.snapshot()
  project.updateGuidePos(ge.id, posMm)
  guideEdit.value = null
  scheduleDraw()
}

onMounted(() => {
  ctx = canvasEl.value!.getContext('2d')
  guidesCtl = new GuidesController({
    stage: stageEl.value!,
    view,
    redraw: scheduleDraw,
    onEdit: openGuideEdit,
  })
  guidesCtl.attach()
  controller = new InteractionController({ stage: stageEl.value!, view, redraw: scheduleDraw })
  controller.attach()
  stageResize = useStageResize(stageEl, view, fitView, scheduleDraw)
  stageResize.observe()
  setAssetImageListener(scheduleDraw)
  window.addEventListener('imglayout:escape', onEditorEscape)
  watch(() => project.doc, scheduleDraw, { deep: true })
  watch(() => project.selectedIds, scheduleDraw, { deep: true })
  watch(() => settings.$state, scheduleDraw, { deep: true })
  fitView()
  scheduleDraw()
})

onBeforeUnmount(() => {
  guidesCtl?.detach()
  controller?.detach()
  window.removeEventListener('imglayout:escape', onEditorEscape)
  setAssetImageListener(() => {})
})
</script>

<template>
  <div ref="stageEl" class="canvas-stage" tabindex="0">
    <canvas ref="canvasEl" class="draw-canvas" />
    <div v-if="guideEdit" class="guide-edit" :style="{ left: guideEdit.left + 'px', top: guideEdit.top + 'px' }">
      <InputNumber
        v-model="guideEdit.value"
        :min="0"
        :max="guideEdit.axis === 'x' ? project.doc.canvas.widthMm : project.doc.canvas.heightMm"
        :step="0.1"
        :max-fraction-digits="1"
        :prefix="guideEdit.axis === 'x' ? 'X ' : 'Y '"
        size="small"
        class="guide-edit-input"
        autofocus
        @keyup.enter="commitGuideEdit"
        @keyup.esc="guideEdit = null"
      />
      <ToggleSwitch v-model="guideEdit.locked" title="锁定参考线" />
      <Button icon="pi pi-check" text title="确定 (Enter)" @click="commitGuideEdit" />
    </div>
  </div>
</template>

<style scoped>
.canvas-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  outline: none;
  touch-action: none;
}
.draw-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.guide-edit {
  position: absolute;
  transform: translate(-50%, -110%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
}
.guide-edit-input {
  width: 110px;
}
</style>
