import { describe, expect, it } from 'vitest'
import { alignRect, boundsOf, distributeRects, type AlignMode } from './align'
import type { RectMm } from '../../types/layout'

const ref: RectMm = { xMm: 0, yMm: 0, wMm: 100, hMm: 100 }

describe('alignRect', () => {
  const rect: RectMm = { xMm: 10, yMm: 20, wMm: 20, hMm: 10 }

  const cases: [AlignMode, Partial<RectMm>][] = [
    ['left', { xMm: 0 }],
    ['right', { xMm: 80 }],
    ['top', { yMm: 0 }],
    ['bottom', { yMm: 90 }],
    ['h-center', { xMm: 40 }],
    ['v-center', { yMm: 45 }],
  ]

  it.each(cases)('%s 对齐到参照矩形', (mode, patch) => {
    expect(alignRect(rect, mode, ref)).toEqual({ ...rect, ...patch })
  })
})

describe('boundsOf', () => {
  it('多矩形包围盒', () => {
    const b = boundsOf([
      { xMm: 10, yMm: 20, wMm: 30, hMm: 40 },
      { xMm: 0, yMm: 50, wMm: 10, hMm: 10 },
    ])
    expect(b).toEqual({ xMm: 0, yMm: 20, wMm: 40, hMm: 40 })
  })

  it('空数组返回零矩形', () => {
    expect(boundsOf([])).toEqual({ xMm: 0, yMm: 0, wMm: 0, hMm: 0 })
  })
})

describe('distributeRects', () => {
  it('三项水平分布：首尾贴边、中间等间隙', () => {
    const items = [
      { id: 'a', rect: { xMm: 30, yMm: 0, wMm: 10, hMm: 10 } },
      { id: 'b', rect: { xMm: 0, yMm: 0, wMm: 20, hMm: 10 } },
      { id: 'c', rect: { xMm: 80, yMm: 0, wMm: 10, hMm: 10 } },
    ]
    const out = distributeRects(items, 'h', ref)
    // 间隙 = (100 − 40) / 2 = 30
    expect(out.get('b')!.xMm).toBe(0)
    expect(out.get('a')!.xMm).toBe(50)
    expect(out.get('c')!.xMm).toBe(90)
  })

  it('垂直分布同理，少于三项原样返回', () => {
    const items = [
      { id: 'a', rect: { xMm: 0, yMm: 0, wMm: 10, hMm: 10 } },
      { id: 'b', rect: { xMm: 0, yMm: 90, wMm: 10, hMm: 10 } },
    ]
    const out = distributeRects(items, 'v', ref)
    expect(out.get('a')).toBe(items[0].rect)
    expect(out.get('b')).toBe(items[1].rect)
  })
})
