// LayoutDoc 数据模型，与 Rust model.rs（serde camelCase）严格一致。
// 几何量一律毫米；DPI 只在导出时换算像素。

export interface LayoutDoc {
  version: number
  canvas: CanvasSpec
  mode: LayoutMode
  grid?: GridConfig
  masonry?: MasonryConfig
  /** 自由布局组合；旧文档无该字段时按空数组处理 */
  groups?: Group[]
  /** 参考线；旧文档无该字段时按空数组处理 */
  guides?: Guide[]
  items: PhotoItem[]
}

/** 'x'=竖直参考线（定 x 坐标），'y'=水平参考线（定 y 坐标） */
export type GuideAxis = 'x' | 'y'

export interface Guide {
  id: string
  axis: GuideAxis
  /** 距成品左缘('x')或顶缘('y')的毫米值，与 item rect 同口径 */
  posMm: number
  /** 锁定后不可拖动/删除 */
  locked?: boolean
}

export interface Group {
  id: string
  name: string | null
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
  /** 隐藏层：不绘制、不导出、画布不可点选 */
  visible: boolean
  /** 0..1，整层与背景的混合比例 */
  opacity: number
  /** 锁定层：画布上禁止移动/缩放/旋转/微调，面板仍可操作 */
  locked: boolean
  /** 图层自定义名，null 回退文件名 */
  name: string | null
  /** 所属组合 id，null 表示未组合 */
  groupId: string | null
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

/** .imglayout 包内 assets/<fileName> 条目的清单信息（layout.yaml 的 assets 数组） */
export interface PackagedAsset {
  assetId: string
  fileName: string
  widthPx: number
  heightPx: number
  /** 保存时的原图绝对路径；打开时若仍存在则继续引用原图，否则用包内提取副本 */
  sourcePath: string | null
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
      widthMm: 297,
      heightMm: 210,
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
    visible: true,
    opacity: 1,
    locked: false,
    name: null,
    groupId: null,
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
