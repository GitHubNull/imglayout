// LayoutDoc 数据模型，与 Rust model.rs（serde camelCase）严格一致。
// 几何量一律毫米；DPI 只在导出时换算像素。

export interface LayoutDoc {
  version: number
  canvas: CanvasSpec
  mode: LayoutMode
  grid?: GridConfig
  masonry?: MasonryConfig
  items: PhotoItem[]
}

export interface CanvasSpec {
  widthMm: number
  heightMm: number
  dpi: number
  background: string
  bleedMm: number
}

export type LayoutMode = 'grid' | 'masonry' | 'free'

export interface GridConfig {
  rows: number
  cols: number
  gapMm: number
  outerMm: number
  fill: FillMode
}

export interface MasonryConfig {
  columns: number
  gapMm: number
  outerMm: number
}

export type FillMode = 'cover' | 'contain'

export interface PhotoItem {
  id: string
  assetId: string
  rect: RectMm
  rotation: number
  flipH: boolean
  flipV: boolean
  adjust: Adjust
  style: Style
  crop: CropNorm | null
}

export interface RectMm {
  xMm: number
  yMm: number
  wMm: number
  hMm: number
}

export interface Adjust {
  brightness: number
  contrast: number
  saturation: number
}

export interface Style {
  radiusMm: number
  borderWidthMm: number
  borderColor: string
}

export interface CropNorm {
  x: number
  y: number
  w: number
  h: number
}

export interface AssetEntry {
  assetId: string
  path: string
  thumbPath: string
  widthPx: number
  heightPx: number
}

export interface Preset {
  id: string
  name: string
  widthMm: number
  heightMm: number
  landscapeWidthMm: number
  landscapeHeightMm: number
}

export function defaultGrid(): GridConfig {
  return { rows: 2, cols: 2, gapMm: 4, outerMm: 8, fill: 'cover' }
}

export function defaultMasonry(): MasonryConfig {
  return { columns: 3, gapMm: 4, outerMm: 8 }
}

export function emptyDoc(): LayoutDoc {
  return {
    version: 1,
    canvas: {
      widthMm: 210,
      heightMm: 297,
      dpi: 300,
      background: '#FFFFFF',
      bleedMm: 0,
    },
    mode: 'grid',
    grid: defaultGrid(),
    items: [],
  }
}

export function newItem(id: string, assetId: string): PhotoItem {
  return {
    id,
    assetId,
    rect: { xMm: 0, yMm: 0, wMm: 0, hMm: 0 },
    rotation: 0,
    flipH: false,
    flipV: false,
    adjust: { brightness: 1, contrast: 1, saturation: 1 },
    style: { radiusMm: 0, borderWidthMm: 0, borderColor: '#000000' },
    crop: null,
  }
}

export function outputPx(canvas: CanvasSpec): { w: number; h: number } {
  const w = Math.round(((canvas.widthMm + 2 * canvas.bleedMm) / 25.4) * canvas.dpi)
  const h = Math.round(((canvas.heightMm + 2 * canvas.bleedMm) / 25.4) * canvas.dpi)
  return { w, h: h }
}

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi)
}
