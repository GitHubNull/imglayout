// 舞台尺寸变化自适应：自动适配态（未手动缩放/平移）重新 fit 到合适大小；
// 手动视图态保持缩放、把内容中心重新对到容器中心（全屏/还原窗口不跑图）。
import { onBeforeUnmount, type Ref } from 'vue'
import type { useCanvasView } from './useCanvasView'

export function useStageResize(
  stageEl: Ref<HTMLDivElement | null>,
  view: ReturnType<typeof useCanvasView>,
  fit: () => void,
  redraw: () => void,
) {
  let lastW = 0
  let lastH = 0
  const observer = new ResizeObserver(() => {
    const el = stageEl.value
    if (!el) return
    const w = el.clientWidth
    const h = el.clientHeight
    if (w === 0 || h === 0) {
      lastW = w
      lastH = h
      return
    }
    if (view.isAutoFit.value) {
      fit()
    } else if (lastW > 0 && lastH > 0 && (w !== lastW || h !== lastH)) {
      view.panBy((w - lastW) / 2, (h - lastH) / 2)
    }
    lastW = w
    lastH = h
    redraw()
  })
  onBeforeUnmount(() => observer.disconnect())
  return {
    observe() {
      if (stageEl.value) observer.observe(stageEl.value)
    },
  }
}
