<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCanvasView } from '../../composables/useCanvasView'
import { fillOf } from '../../stores/project'
import { useProjectStore } from '../../stores/project'
import { setAssetImageListener, useAssetsStore } from '../../stores/assets'
import { InteractionController, HANDLES } from './InteractionController'
import type { PhotoItem, RectMm } from '../../types/layout'

const stageEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

const project = useProjectStore()
const assets = useAssetsStore()
const view = useCanvasView()

let ctx: CanvasRenderingContext2D | null = null
let controller: InteractionController | null = null
let resizeObserver: ResizeObserver | null = null
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
  if (!el) return
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

function drawItem(item: PhotoItem, rect: RectMm, index: number) {
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
  roundedRectPath(dx, dy, dw, dh, radiusPx)
  ctx!.clip()

  if (item.rotation % 360 !== 0) {
    ctx!.translate(dx + dw / 2, dy + dh / 2)
    ctx!.rotate((item.rotation * Math.PI) / 180)
    ctx!.translate(-(dx + dw / 2), -(dy + dh / 2))
  }

  // contain：格内留白填画布背景色
  if (fill === 'contain') {
    ctx!.fillStyle = c.background
    ctx!.fillRect(dx - radiusPx, dy - radiusPx, dw + radiusPx * 2, dh + radiusPx * 2)
  }

  if (img && img.complete && img.naturalWidth > 0) {
    const boxAspect = dw / dh
    const srcAspect = img.naturalWidth / img.naturalHeight
    let sx = 0
    let sy = 0
    let sw = img.naturalWidth
    let sh = img.naturalHeight
    let destX = dx
    let destY = dy
    let destW = dw
    let destH = dh
    if (fill === 'cover') {
      if (srcAspect > boxAspect) {
        sw = img.naturalHeight * boxAspect
        sx = (img.naturalWidth - sw) / 2
      } else {
        sh = img.naturalWidth / boxAspect
        sy = (img.naturalHeight - sh) / 2
      }
    } else {
      const scale = Math.min(dw / img.naturalWidth, dh / img.naturalHeight)
      destW = img.naturalWidth * scale
      destH = img.naturalHeight * scale
      destX = dx + (dw - destW) / 2
      destY = dy + (dh - destH) / 2
    }
    ctx!.drawImage(img, sx, sy, sw, sh, destX, destY, destW, destH)
  } else {
    // 缩略图未就绪：占位灰
    ctx!.fillStyle = '#D8D8D4'
    ctx!.fillRect(dx, dy, dw, dh)
  }
  ctx!.restore()

  if (borderPx > 0) {
    ctx!.save()
    roundedRectPath(dx + borderPx / 2, dy + borderPx / 2, dw - borderPx, dh - borderPx, Math.max(0, radiusPx - borderPx / 2))
    ctx!.strokeStyle = item.style.borderColor
    ctx!.lineWidth = borderPx
    ctx!.stroke()
    ctx!.restore()
  }

  if (item.id === project.selectedId) {
    drawSelection(rect, index)
  }
}

function drawSelection(rect: RectMm, _index: number) {
  const c = project.doc.canvas
  const s = view.pxPerMm.value
  const dx = view.screenX(rect.xMm, c.bleedMm)
  const dy = view.screenY(rect.yMm, c.bleedMm)
  const dw = rect.wMm * s
  const dh = rect.hMm * s
  ctx!.save()
  ctx!.strokeStyle = '#3B82F6'
  ctx!.lineWidth = 1.5
  ctx!.setLineDash([4, 3])
  ctx!.strokeRect(dx, dy, dw, dh)
  ctx!.setLineDash([])
  if (project.doc.mode === 'free') {
    ctx!.fillStyle = '#FFFFFF'
    ctx!.strokeStyle = '#3B82F6'
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

  // 工作台
  ctx.fillStyle = '#E9E9E6'
  ctx.fillRect(0, 0, w, h)

  const c = project.doc.canvas
  const { w: outW, h: outH } = outSizeMm()
  const s = view.pxPerMm.value
  const ox = view.originX.value
  const oy = view.originY.value

  // 输出画布（含出血）
  ctx.fillStyle = /^#[0-9A-Fa-f]{3,8}$/.test(c.background) ? c.background : '#FFFFFF'
  ctx.fillRect(ox, oy, outW * s, outH * s)
  ctx.strokeStyle = '#9CA3AF'
  ctx.lineWidth = 1
  ctx.strokeRect(ox - 0.5, oy - 0.5, outW * s + 1, outH * s + 1)

  // 成品裁切线（出血内沿，虚线）
  if (c.bleedMm > 0) {
    const bx = c.bleedMm * s
    ctx.save()
    ctx.strokeStyle = '#EF4444'
    ctx.setLineDash([6, 4])
    ctx.strokeRect(ox + bx, oy + bx, c.widthMm * s, c.heightMm * s)
    ctx.restore()
  }

  const rects = project.rects
  project.doc.items.forEach((item, i) => {
    const rect = rects[i]
    if (rect) drawItem(item, rect, i)
  })
}

function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  const project = useProjectStore()
  if (e.key === 'Delete' || e.key === 'Backspace') {
    controller?.deleteSelected()
  } else if (e.key === 'Escape') {
    project.select(null)
    scheduleDraw()
  } else if (e.key === 'ArrowLeft' && e.shiftKey) {
    controller?.nudgeSelected(-1, 0)
  } else if (e.key === 'ArrowRight' && e.shiftKey) {
    controller?.nudgeSelected(1, 0)
  } else if (e.key === 'ArrowUp' && e.shiftKey) {
    controller?.nudgeSelected(0, -1)
  } else if (e.key === 'ArrowDown' && e.shiftKey) {
    controller?.nudgeSelected(0, 1)
  }
}

onMounted(() => {
  ctx = canvasEl.value!.getContext('2d')
  controller = new InteractionController({ stage: stageEl.value!, view, redraw: scheduleDraw })
  controller.attach()
  resizeObserver = new ResizeObserver(() => {
    scheduleDraw()
  })
  resizeObserver.observe(stageEl.value!)
  setAssetImageListener(scheduleDraw)
  window.addEventListener('keydown', onKeyDown)
  watch(() => project.doc, scheduleDraw, { deep: true })
  watch(() => project.selectedId, scheduleDraw)
  fitView()
  scheduleDraw()
})

onBeforeUnmount(() => {
  controller?.detach()
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', onKeyDown)
  setAssetImageListener(() => {})
})
</script>

<template>
  <div ref="stageEl" class="canvas-stage" tabindex="0">
    <canvas ref="canvasEl" class="draw-canvas" />
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
</style>
