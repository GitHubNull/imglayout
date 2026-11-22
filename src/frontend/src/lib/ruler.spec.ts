import { describe, expect, it } from 'vitest'
import { rulerSteps } from './ruler'

describe('rulerSteps', () => {
  it('刻度间距不低于 8px，取满足条件的最小档', () => {
    expect(rulerSteps(20)).toBe(1) // 20px/mm → 1mm 刻度 = 20px
    expect(rulerSteps(8)).toBe(1)
    expect(rulerSteps(7)).toBe(2)
    expect(rulerSteps(3)).toBe(5) // 5mm × 3 = 15px ≥ 8；2mm × 3 = 6px 太密
    expect(rulerSteps(1)).toBe(10)
    expect(rulerSteps(0.2)).toBe(50)
  })
})
