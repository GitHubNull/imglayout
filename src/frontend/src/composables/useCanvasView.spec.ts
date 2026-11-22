import { describe, expect, it } from 'vitest'
import { MAX_PX_PER_MM, MIN_PX_PER_MM, useCanvasView } from './useCanvasView'

function expectedPercent(pxPerMm: number): number {
  return Math.round((pxPerMm / (96 / 25.4)) * 100)
}

describe('useCanvasView', () => {
  it('zoomPercent 随 zoomAt 变化（光标锚点）', () => {
    const view = useCanvasView()
    const before = view.pxPerMm.value
    expect(view.zoomPercent.value).toBe(expectedPercent(before))

    view.zoomAt(200, 150, 2)
    expect(view.pxPerMm.value).toBeCloseTo(before * 2, 6)
    expect(view.zoomPercent.value).toBe(expectedPercent(view.pxPerMm.value))
  })

  it('zoomAt 受上下限钳制', () => {
    const view = useCanvasView()
    view.zoomAt(0, 0, 1e9)
    expect(view.pxPerMm.value).toBe(MAX_PX_PER_MM)
    view.zoomAt(0, 0, 1e-9)
    expect(view.pxPerMm.value).toBe(MIN_PX_PER_MM)
  })

  it('zoomAt 以光标为锚点不动点', () => {
    const view = useCanvasView()
    // 光标处的毫米坐标缩放前后不变
    const mmBeforeX = view.mmX(200, 3)
    const mmBeforeY = view.mmY(150, 3)
    view.zoomAt(200, 150, 1.5)
    expect(view.mmX(200, 3)).toBeCloseTo(mmBeforeX, 6)
    expect(view.mmY(150, 3)).toBeCloseTo(mmBeforeY, 6)
  })

  it('fit 让输出尺寸进入视口并居中', () => {
    const view = useCanvasView()
    view.fit(1000, 800, 297, 210)
    const s = view.pxPerMm.value
    expect(297 * s).toBeLessThanOrEqual(1000)
    expect(210 * s).toBeLessThanOrEqual(800)
    // 左原点 = (视口宽 - 输出宽)/2，含出血偏移由 screenX 处理
    expect(view.originX.value).toBeCloseTo((1000 - 297 * s) / 2, 6)
    expect(view.zoomPercent.value).toBe(expectedPercent(s))
  })

  it('fit 进入自动适配态，zoomAt/panBy 退出', () => {
    const view = useCanvasView()
    expect(view.isAutoFit.value).toBe(true)
    view.zoomAt(100, 100, 1.5)
    expect(view.isAutoFit.value).toBe(false)
    view.fit(1000, 800, 297, 210)
    expect(view.isAutoFit.value).toBe(true)
    view.panBy(10, 5)
    expect(view.isAutoFit.value).toBe(false)
  })

  it('recenterBy 只平移原点，不退出自动适配态', () => {
    const view = useCanvasView()
    view.fit(1000, 800, 297, 210)
    const ox = view.originX.value
    const oy = view.originY.value
    const s = view.pxPerMm.value
    view.recenterBy(30, -20)
    expect(view.originX.value).toBeCloseTo(ox + 30, 6)
    expect(view.originY.value).toBeCloseTo(oy - 20, 6)
    expect(view.pxPerMm.value).toBe(s)
    expect(view.isAutoFit.value).toBe(true)
  })
})
