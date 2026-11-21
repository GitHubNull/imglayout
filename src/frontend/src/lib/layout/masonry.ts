// 瀑布流排版 —— Rust layout/masonry.rs 的 TS 镜像（预览用）。
import type { CanvasSpec, MasonryConfig, PhotoItem, RectMm } from '../../types/layout'

export interface MasonryInput {
  item: PhotoItem
  size: [number, number]
}

export function layoutMasonry(
  canvas: CanvasSpec,
  cfg: MasonryConfig,
  inputs: MasonryInput[],
): RectMm[] {
  const columns = Math.max(1, cfg.columns)
  const contentW = Math.max(0, canvas.widthMm - 2 * cfg.outerMm)
  const colW = Math.max(
    0,
    columns > 1 ? (contentW - (columns - 1) * cfg.gapMm) / columns : contentW,
  )

  const colHeights = new Array<number>(columns).fill(cfg.outerMm)
  const rects: RectMm[] = []

  for (const { item, size } of inputs) {
    const aspect = croppedAspect(item, size)
    const boxH = aspect > 0 ? colW / aspect : colW

    let colIdx = 0
    for (let i = 1; i < columns; i++) {
      if (colHeights[i] < colHeights[colIdx]) colIdx = i
    }

    rects.push({
      xMm: cfg.outerMm + colIdx * (colW + cfg.gapMm),
      yMm: colHeights[colIdx],
      wMm: colW,
      hMm: boxH,
    })
    colHeights[colIdx] += boxH + cfg.gapMm
  }

  return rects
}

function croppedAspect(item: PhotoItem, [srcW, srcH]: [number, number]): number {
  const c = item.crop
  if (c && c.w > 0 && c.h > 0) {
    return (c.w * srcW) / (c.h * srcH)
  }
  return srcH > 0 ? srcW / srcH : 1
}
