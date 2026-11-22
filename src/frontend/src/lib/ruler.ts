// 标尺刻度步长与标尺绘制：保证相邻主刻度在屏幕上至少间隔 MIN_TICK_PX 像素
import type { useCanvasView } from '../composables/useCanvasView'
import type { CanvasSpec } from '../types/layout'
import type { RulerPalette } from './canvasTheme'

const MIN_TICK_PX = 8
/** 标尺带宽度（屏幕像素，固定）；交互命中（拖出参考线）也用这个值 */
export const RULER_BAND_PX = 20

type View = ReturnType<typeof useCanvasView>

export function rulerSteps(pxPerMm: number): number {
  for (const s of [1, 2, 5, 10, 20, 50]) {
    if (s * pxPerMm >= MIN_TICK_PX) return s
  }
  return 50
}

/** 标尺：X 轴在底部、Y 轴在左侧，原点 = 成品左下角（Y 从底部向上读数） */
export function drawRulers(
  ctx: CanvasRenderingContext2D,
  view: View,
  w: number,
  h: number,
  c: CanvasSpec,
  pal: RulerPalette,
) {
  const s = view.pxPerMm.value
  const b = c.bleedMm
  const R = RULER_BAND_PX
  const step = rulerSteps(s)

  ctx.save()
  ctx.fillStyle = pal.bandBg
  ctx.fillRect(0, 0, R, h)
  ctx.fillRect(0, h - R, w, R)
  ctx.strokeStyle = pal.bandStroke
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(R + 0.5, 0)
  ctx.lineTo(R + 0.5, h)
  ctx.moveTo(0, h - R + 0.5)
  ctx.lineTo(w, h - R + 0.5)
  ctx.stroke()

  ctx.fillStyle = pal.text
  ctx.strokeStyle = pal.tick
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // X 轴：标签 = 距成品左缘的毫米值
  for (let v = Math.ceil(-b / step) * step; v <= c.widthMm + b + 1e-6; v += step) {
    const x = Math.round(view.screenX(v, b)) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, h - R)
    ctx.lineTo(x, h - R + (Math.abs(v % (step * 5)) < 1e-6 ? 7 : 4))
    ctx.stroke()
    if (v >= -1e-6 && v <= c.widthMm + 1e-6) {
      ctx.fillText(String(Math.round(v * 10) / 10), x + 2, h - R + 11)
    }
  }

  // Y 轴：标签 = 距成品底缘的毫米值（= heightMm − mmY），左对齐防三位数被裁
  ctx.textAlign = 'left'
  for (let v = Math.ceil(-b / step) * step; v <= c.heightMm + b + 1e-6; v += step) {
    const y = Math.round(view.screenY(v, b)) + 0.5
    ctx.beginPath()
    ctx.moveTo(R, y)
    ctx.lineTo(R - (Math.abs(v % (step * 5)) < 1e-6 ? 7 : 4), y)
    ctx.stroke()
    if (v >= -1e-6 && v <= c.heightMm + 1e-6) {
      ctx.fillText(String(Math.round((c.heightMm - v) * 10) / 10), 2, y + 3)
    }
  }
  ctx.restore()
}
