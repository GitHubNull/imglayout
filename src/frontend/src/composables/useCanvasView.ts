// 视口 transform：屏幕像素 ⇄ 毫米。原点 = 最终输出（含出血）左上角。
import { computed, ref } from 'vue'

export const MIN_PX_PER_MM = 0.2
export const MAX_PX_PER_MM = 20
// CSS 96dpi 下 1mm 的屏幕像素，用于“100%”档位
const PX_PER_MM_AT_100 = 96 / 25.4

export function useCanvasView() {
  const pxPerMm = ref(3)
  const originX = ref(0)
  const originY = ref(0)
  /** 自动适配态：未手动缩放/平移前为 true，容器 resize 时重新 fit；手动操作后转为 false（只保缩放重居中） */
  const isAutoFit = ref(true)

  const zoomPercent = computed(() =>
    Math.round((pxPerMm.value / PX_PER_MM_AT_100) * 100),
  )

  function screenX(mmX: number, bleedMm: number): number {
    return originX.value + (mmX + bleedMm) * pxPerMm.value
  }
  function screenY(mmY: number, bleedMm: number): number {
    return originY.value + (mmY + bleedMm) * pxPerMm.value
  }
  function mmX(screen: number, bleedMm: number): number {
    return (screen - originX.value) / pxPerMm.value - bleedMm
  }
  function mmY(screen: number, bleedMm: number): number {
    return (screen - originY.value) / pxPerMm.value - bleedMm
  }

  function clampScale(v: number): number {
    return Math.min(MAX_PX_PER_MM, Math.max(MIN_PX_PER_MM, v))
  }

  function zoomAt(screenPxX: number, screenPxY: number, factor: number) {
    isAutoFit.value = false
    const next = clampScale(pxPerMm.value * factor)
    const applied = next / pxPerMm.value
    originX.value = screenPxX - (screenPxX - originX.value) * applied
    originY.value = screenPxY - (screenPxY - originY.value) * applied
    pxPerMm.value = next
  }

  function panBy(dxPx: number, dyPx: number) {
    isAutoFit.value = false
    originX.value += dxPx
    originY.value += dyPx
  }

  function fit(viewW: number, viewH: number, outWmm: number, outHmm: number) {
    isAutoFit.value = true
    const margin = 48
    const scale = Math.min(
      (viewW - margin * 2) / outWmm,
      (viewH - margin * 2) / outHmm,
    )
    pxPerMm.value = clampScale(scale)
    originX.value = (viewW - outWmm * pxPerMm.value) / 2
    originY.value = (viewH - outHmm * pxPerMm.value) / 2
  }

  function zoomTo(viewW: number, viewH: number, levelPxPerMm: number) {
    const cx = viewW / 2
    const cy = viewH / 2
    zoomAt(cx, cy, levelPxPerMm / pxPerMm.value)
  }

  return {
    pxPerMm,
    originX,
    originY,
    isAutoFit,
    zoomPercent,
    screenX,
    screenY,
    mmX,
    mmY,
    zoomAt,
    panBy,
    fit,
    zoomTo,
    PX_PER_MM_AT_100,
  }
}
