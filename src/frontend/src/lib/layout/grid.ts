// 规则网格排版 —— Rust layout/grid.rs 的 TS 镜像（预览用），两侧对拍同一组 fixtures。
import type { CanvasSpec, GridConfig, PhotoItem, RectMm } from '../../types/layout'

export function layoutGrid(
  canvas: CanvasSpec,
  cfg: GridConfig,
  items: PhotoItem[],
): (RectMm | null)[] {
  const cols = Math.max(1, cfg.cols)
  const rows = Math.max(1, cfg.rows)
  const capacity = rows * cols

  const contentW = Math.max(0, canvas.widthMm - 2 * cfg.outerMm)
  const contentH = Math.max(0, canvas.heightMm - 2 * cfg.outerMm)
  const cellW = Math.max(
    0,
    cols > 1 ? (contentW - (cols - 1) * cfg.gapMm) / cols : contentW,
  )
  const cellH = Math.max(
    0,
    rows > 1 ? (contentH - (rows - 1) * cfg.gapMm) / rows : contentH,
  )

  return items.map((_, i) => {
    if (i >= capacity) return null
    const row = Math.floor(i / cols)
    const col = i % cols
    return {
      xMm: cfg.outerMm + col * (cellW + cfg.gapMm),
      yMm: cfg.outerMm + row * (cellH + cfg.gapMm),
      wMm: cellW,
      hMm: cellH,
    }
  })
}
