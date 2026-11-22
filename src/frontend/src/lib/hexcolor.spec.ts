import { describe, expect, it } from 'vitest'
import { normalizeHexColor } from './hexcolor'

describe('normalizeHexColor（收敛 PrimeVue ColorPicker 输出）', () => {
  it('无 # 前缀的 6 位 hex 补前缀并大写', () => {
    expect(normalizeHexColor('ff0000', '#FFFFFF')).toBe('#FF0000')
    expect(normalizeHexColor('00ff88', '#FFFFFF')).toBe('#00FF88')
  })

  it('带 # 的合法值原样大写返回', () => {
    expect(normalizeHexColor('#ff0000', '#FFFFFF')).toBe('#FF0000')
    expect(normalizeHexColor('#ABCDEF', '#FFFFFF')).toBe('#ABCDEF')
  })

  it('非法值与非字符串回落 fallback', () => {
    expect(normalizeHexColor('red', '#FFFFFF')).toBe('#FFFFFF')
    expect(normalizeHexColor('#12345', '#FFFFFF')).toBe('#FFFFFF')
    expect(normalizeHexColor(undefined, '#000000')).toBe('#000000')
    expect(normalizeHexColor({ h: 0, s: 100, b: 100 }, '#000000')).toBe('#000000')
  })
})
