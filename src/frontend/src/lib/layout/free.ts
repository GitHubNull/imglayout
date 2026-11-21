// 自由排版吸附 —— Rust layout/free.rs 的 TS 镜像（预览/交互用）。
import type { CanvasSpec, RectMm } from '../../types/layout'

export const SNAP_TOLERANCE_MM = 0.5

export function snapTargets(canvas: CanvasSpec, others: RectMm[]): number[] {
  const targets = [
    0,
    canvas.widthMm / 2,
    canvas.widthMm,
    0,
    canvas.heightMm / 2,
    canvas.heightMm,
  ]
  for (const r of others) {
    targets.push(r.xMm, r.xMm + r.wMm / 2, r.xMm + r.wMm)
    targets.push(r.yMm, r.yMm + r.hMm / 2, r.yMm + r.hMm)
  }
  targets.sort((a, b) => a - b)
  const deduped = targets.filter((v, i) => i === 0 || Math.abs(v - targets[i - 1]) >= 1e-9)
  return deduped
}

export function snapValue(v: number, targets: number[]): number {
  let best = v
  let bestDist = SNAP_TOLERANCE_MM
  for (const t of targets) {
    const d = Math.abs(t - v)
    if (d <= bestDist) {
      bestDist = d
      best = t
    }
  }
  return best
}

export function snapRectTranslate(
  rect: RectMm,
  targetsX: number[],
  targetsY: number[],
): RectMm {
  const candidatesX = [rect.xMm, rect.xMm + rect.wMm / 2, rect.xMm + rect.wMm]
  const candidatesY = [rect.yMm, rect.yMm + rect.hMm / 2, rect.yMm + rect.hMm]
  const dx = bestDelta(candidatesX, targetsX)
  const dy = bestDelta(candidatesY, targetsY)
  return { ...rect, xMm: rect.xMm + dx, yMm: rect.yMm + dy }
}

function bestDelta(candidates: number[], targets: number[]): number {
  let best = 0
  let bestAbs = SNAP_TOLERANCE_MM
  for (const c of candidates) {
    for (const t of targets) {
      const d = t - c
      if (Math.abs(d) <= bestAbs) {
        best = d
        bestAbs = Math.abs(d)
      }
    }
  }
  return best
}

export function clampMinSize(rect: RectMm, minMm: number): RectMm {
  return { ...rect, wMm: Math.max(minMm, rect.wMm), hMm: Math.max(minMm, rect.hMm) }
}
