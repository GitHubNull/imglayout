// 与 Rust 侧单元测试同一组 fixtures 的对拍测试（src/backend/src/layout/*、units.rs）。
// 期望值必须与 Rust 测试断言逐值一致。
import { describe, expect, it } from 'vitest'
import {
  defaultGrid,
  emptyDoc,
  mmToPx,
  newItem,
  outputPx,
  type CanvasSpec,
  type PhotoItem,
  type RectMm,
} from '../../types/layout'
import { layoutGrid } from './grid'
import { layoutMasonry } from './masonry'
import { clampMinSize, snapGridTranslate, snapRectTranslate, snapTargets, snapValue } from './free'

function canvas(w: number, h: number): CanvasSpec {
  return { ...emptyDoc().canvas, widthMm: w, heightMm: h }
}

function item(id: string): PhotoItem {
  return newItem(id, id)
}

describe('units 对拍', () => {
  it('mmToPx 与 Rust mm_to_px 一致', () => {
    expect(mmToPx(25.4, 300)).toBe(300)
    expect(mmToPx(89, 300)).toBe(1051)
    expect(mmToPx(127, 300)).toBe(1500)
  })

  it('出血画布像素尺寸与 Rust canvas_px_size 一致', () => {
    expect(outputPx({ ...canvas(254, 381), bleedMm: 3 })).toEqual({ w: 3071, h: 4571 })
    expect(outputPx({ ...canvas(100, 100), bleedMm: 3 })).toEqual({ w: 1252, h: 1252 })
  })
})

describe('grid 对拍', () => {
  const grid = { ...defaultGrid(), rows: 2, cols: 2 }

  it('无间距等分', () => {
    const items = [item('a'), item('b'), item('c'), item('d')]
    const rects = layoutGrid(canvas(100, 100), { ...grid, gapMm: 0, outerMm: 0 }, items)
    expect(rects[3]).toEqual({ xMm: 50, yMm: 50, wMm: 50, hMm: 50 })
  })

  it('gap 与 outer 偏移', () => {
    const items = [item('a'), item('b'), item('c'), item('d')]
    const rects = layoutGrid(canvas(100, 100), { ...grid, gapMm: 5, outerMm: 10 }, items)
    expect(rects[0]!.xMm).toBe(10)
    expect(rects[1]!.xMm).toBe(52.5)
    expect(rects[2]!.yMm).toBe(52.5)
    expect(rects[0]!.wMm).toBe(37.5)
  })

  it('超容量为 null', () => {
    const rects = layoutGrid(canvas(100, 100), { ...grid, rows: 1, gapMm: 0, outerMm: 0 }, [
      item('a'),
      item('b'),
      item('c'),
    ])
    expect(rects[2]).toBeNull()
  })

  it('零边距满版', () => {
    const rects = layoutGrid(canvas(100, 50), { ...grid, rows: 1, gapMm: 0, outerMm: 0 }, [
      item('a'),
      item('b'),
    ])
    expect(rects[1]!.xMm + rects[1]!.wMm).toBe(100)
  })
})

describe('masonry 对拍', () => {
  const cfg = { columns: 2, gapMm: 0, outerMm: 0 }

  it('最短列填充', () => {
    const square = item('a')
    const wide = item('b')
    const rects = layoutMasonry(canvas(100, 1000), cfg, [
      { item: square, size: [100, 100] },
      { item: wide, size: [200, 100] },
      { item: square, size: [100, 100] },
    ])
    expect(rects[0].xMm).toBe(0)
    expect([rects[1].xMm, rects[1].yMm, rects[1].hMm]).toEqual([50, 0, 25])
    expect([rects[2].xMm, rects[2].yMm]).toEqual([50, 25])
  })

  it('crop 窗口折算宽高比', () => {
    const cropped: PhotoItem = { ...item('a'), crop: { x: 0, y: 0, w: 0.25, h: 1 } }
    const plain = item('b')
    const rects = layoutMasonry(canvas(50, 1000), { ...cfg, columns: 1 }, [
      { item: cropped, size: [400, 100] },
      { item: plain, size: [100, 100] },
    ])
    expect(rects[0].hMm).toBe(50)
  })

  it('gap 生效', () => {
    const first = item('a')
    const second = item('b')
    const rects = layoutMasonry(canvas(105, 1000), { ...cfg, gapMm: 5 }, [
      { item: first, size: [100, 100] },
      { item: second, size: [100, 100] },
    ])
    expect(rects[0].wMm).toBe(50)
    expect(rects[1].xMm).toBe(55)
  })
})

describe('free 吸附对拍', () => {
  it('容差内吸附、容差外原样', () => {
    expect(snapValue(10.2, [10])).toBe(10)
    expect(snapValue(10.6, [10])).toBe(10.6)
    expect(snapValue(10, [])).toBe(10)
    expect(snapValue(20.3, [10, 20])).toBe(20)
  })

  it('平移吸附到画布中线', () => {
    const rect: RectMm = { xMm: 49.7, yMm: 10, wMm: 20, hMm: 20 }
    const snapped = snapRectTranslate(rect, [0, 50, 100], [])
    expect(snapped.xMm).toBe(50)
    expect(snapped.yMm).toBe(10)
  })

  it('目标包含其他对象边缘', () => {
    const targets = snapTargets(canvas(100, 100), [{ xMm: 30, yMm: 40, wMm: 10, hMm: 10 }])
    expect(targets).toContain(30)
    expect(targets).toContain(35)
    expect(targets).toContain(40)
  })

  it('clampMinSize 保位置', () => {
    const r = clampMinSize({ xMm: 5, yMm: 5, wMm: 0, hMm: -3 }, 1)
    expect(r).toEqual({ xMm: 5, yMm: 5, wMm: 1, hMm: 1 })
  })

  it('snapGridTranslate 左上角对齐到最近网格点', () => {
    const rect: RectMm = { xMm: 12.6, yMm: 3.2, wMm: 20, hMm: 20 }
    expect(snapGridTranslate(rect, 5)).toEqual({ xMm: 15, yMm: 5, wMm: 20, hMm: 20 })
    expect(snapGridTranslate(rect, 0)).toBe(rect)
    expect(snapGridTranslate({ ...rect, xMm: 12.4 }, 5).xMm).toBe(10)
  })

  it('参考线坐标并入吸附目标（x/y 分轴）', () => {
    const rect: RectMm = { xMm: 99.7, yMm: 14.7, wMm: 20, hMm: 20 }
    const snapped = snapRectTranslate(rect, [100], [15])
    expect(snapped.xMm).toBe(100)
    expect(snapped.yMm).toBe(15)
    // 分轴独立：x 目标不影响 y
    const snapped2 = snapRectTranslate(rect, [], [15])
    expect(snapped2.xMm).toBe(99.7)
    expect(snapped2.yMm).toBe(15)
  })
})
