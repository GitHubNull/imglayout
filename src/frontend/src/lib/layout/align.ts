// 对齐 / 分布纯函数：参照矩形由调用方给出（PS 口径：多选取选区包围盒，单选取画布）
import type { RectMm } from '../../types/layout'

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'h-center' | 'v-center'
export type DistributeAxis = 'h' | 'v'
export type AlignOp = AlignMode | 'distribute-h' | 'distribute-v'

export function boundsOf(rects: RectMm[]): RectMm {
  if (rects.length === 0) return { xMm: 0, yMm: 0, wMm: 0, hMm: 0 }
  const x0 = Math.min(...rects.map((r) => r.xMm))
  const y0 = Math.min(...rects.map((r) => r.yMm))
  const x1 = Math.max(...rects.map((r) => r.xMm + r.wMm))
  const y1 = Math.max(...rects.map((r) => r.yMm + r.hMm))
  return { xMm: x0, yMm: y0, wMm: x1 - x0, hMm: y1 - y0 }
}

export function alignRect(rect: RectMm, mode: AlignMode, ref: RectMm): RectMm {
  switch (mode) {
    case 'left':
      return { ...rect, xMm: ref.xMm }
    case 'right':
      return { ...rect, xMm: ref.xMm + ref.wMm - rect.wMm }
    case 'top':
      return { ...rect, yMm: ref.yMm }
    case 'bottom':
      return { ...rect, yMm: ref.yMm + ref.hMm - rect.hMm }
    case 'h-center':
      return { ...rect, xMm: ref.xMm + (ref.wMm - rect.wMm) / 2 }
    case 'v-center':
      return { ...rect, yMm: ref.yMm + (ref.hMm - rect.hMm) / 2 }
  }
}

/**
 * 平均分布：首尾贴参照边缘，中间项等间隙排列（间隙可为负，即重叠挤压）。
 * 返回 id → 新 rect 的映射，与输入顺序无关。
 */
export function distributeRects<T extends { id: string; rect: RectMm }>(
  items: T[],
  axis: DistributeAxis,
  ref: RectMm,
): Map<string, RectMm> {
  const out = new Map<string, RectMm>()
  const n = items.length
  if (n < 3) {
    for (const item of items) out.set(item.id, item.rect)
    return out
  }
  const sorted = [...items].sort((a, b) =>
    axis === 'h' ? a.rect.xMm - b.rect.xMm : a.rect.yMm - b.rect.yMm,
  )
  if (axis === 'h') {
    const total = sorted.reduce((s, i) => s + i.rect.wMm, 0)
    const gap = (ref.wMm - total) / (n - 1)
    let x = ref.xMm
    for (const item of sorted) {
      out.set(item.id, { ...item.rect, xMm: x })
      x += item.rect.wMm + gap
    }
  } else {
    const total = sorted.reduce((s, i) => s + i.rect.hMm, 0)
    const gap = (ref.hMm - total) / (n - 1)
    let y = ref.yMm
    for (const item of sorted) {
      out.set(item.id, { ...item.rect, yMm: y })
      y += item.rect.hMm + gap
    }
  }
  return out
}
