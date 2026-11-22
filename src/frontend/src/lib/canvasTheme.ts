// 画布 2D 绘制调色板：亮 = 原硬编码浅色值，暗 = PS 式暗灰（亮色值在暗底上需提亮保证对比）
export interface RulerPalette {
  bandBg: string
  bandStroke: string
  tick: string
  text: string
}

export interface GuidesPalette {
  normal: string
  hover: string
  selected: string
  draft: string
  snapped: string
  labelBg: string
}

export interface CanvasPalette {
  workbenchBg: string
  thumbPlaceholder: string
  outStroke: string
  cropLine: string
  gridLine: string
  selPrimary: string
  selSecondary: string
  handleFill: string
  marqueeStroke: string
  marqueeFill: string
  alignLine: string
  ruler: RulerPalette
  guides: GuidesPalette
}

export const LIGHT_PALETTE: CanvasPalette = {
  workbenchBg: '#E9E9E6',
  thumbPlaceholder: '#D8D8D4',
  outStroke: '#9CA3AF',
  cropLine: '#EF4444',
  gridLine: 'rgba(59, 130, 246, 0.14)',
  selPrimary: '#3B82F6',
  selSecondary: '#60A5FA',
  handleFill: '#FFFFFF',
  marqueeStroke: '#3B82F6',
  marqueeFill: 'rgba(59, 130, 246, 0.08)',
  alignLine: 'rgba(236, 72, 153, 0.85)',
  ruler: {
    bandBg: 'rgba(250, 250, 249, 0.94)',
    bandStroke: '#D6D3D1',
    tick: '#A8A29E',
    text: '#78716C',
  },
  guides: {
    normal: '#0EA5E9',
    hover: '#0284C7',
    selected: '#F59E0B',
    draft: 'rgba(14, 165, 233, 0.6)',
    snapped: '#D946EF',
    labelBg: 'rgba(255, 255, 255, 0.88)',
  },
}

export const DARK_PALETTE: CanvasPalette = {
  workbenchBg: '#2B2B2E',
  thumbPlaceholder: '#3A3A3E',
  outStroke: '#55555A',
  cropLine: '#F87171',
  gridLine: 'rgba(96, 165, 250, 0.16)',
  selPrimary: '#60A5FA',
  selSecondary: '#93C5FD',
  handleFill: '#1F1F23',
  marqueeStroke: '#60A5FA',
  marqueeFill: 'rgba(96, 165, 250, 0.12)',
  alignLine: 'rgba(244, 114, 182, 0.9)',
  ruler: {
    bandBg: 'rgba(30, 30, 34, 0.94)',
    bandStroke: '#4A4A50',
    tick: '#7C7C85',
    text: '#A9A9B2',
  },
  guides: {
    normal: '#38BDF8',
    hover: '#7DD3FC',
    selected: '#FBBF24',
    draft: 'rgba(56, 189, 248, 0.6)',
    snapped: '#E879F9',
    labelBg: 'rgba(30, 30, 34, 0.88)',
  },
}

export function canvasPalette(theme: 'dark' | 'light'): CanvasPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
}
