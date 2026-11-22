import { describe, expect, it } from 'vitest'
import { canvasPalette, DARK_PALETTE, LIGHT_PALETTE } from './canvasTheme'

function keysOf(obj: object): string[] {
  return Object.keys(obj).sort()
}

describe('canvasTheme 画布调色板', () => {
  it('亮/暗两套调色板字段完全一致', () => {
    expect(keysOf(DARK_PALETTE)).toEqual(keysOf(LIGHT_PALETTE))
    expect(keysOf(DARK_PALETTE.ruler)).toEqual(keysOf(LIGHT_PALETTE.ruler))
    expect(keysOf(DARK_PALETTE.guides)).toEqual(keysOf(LIGHT_PALETTE.guides))
  })

  it('canvasPalette 按主题返回对应调色板', () => {
    expect(canvasPalette('dark')).toBe(DARK_PALETTE)
    expect(canvasPalette('light')).toBe(LIGHT_PALETTE)
  })

  it('暗色关键项与亮色不同（工作台/标尺/参考线标签底色）', () => {
    expect(DARK_PALETTE.workbenchBg).not.toBe(LIGHT_PALETTE.workbenchBg)
    expect(DARK_PALETTE.ruler.bandBg).not.toBe(LIGHT_PALETTE.ruler.bandBg)
    expect(DARK_PALETTE.guides.labelBg).not.toBe(LIGHT_PALETTE.guides.labelBg)
  })
})
