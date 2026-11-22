// 自由排版吸附 —— Rust layout/free.rs 的 TS 镜像（预览/交互用）。
import type { CanvasSpec, GuideAxis, RectMm } from '../../types/layout'

/** 默认容差（mm）：低缩放时改用 SNAP_TOLERANCE_PX 换算的动态容差 */
export const SNAP_TOLERANCE_MM = 0.5
/** 屏幕像素容差：换算 mm = SNAP_TOLERANCE_PX / pxPerMm（缩放越小容差越大，PS 口径） */
export const SNAP_TOLERANCE_PX = 5

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

/** 单值吸附并返回命中距离：容差内取最近目标（并列取后出现者，与 snapValue 同规则），未命中 dist 为 Infinity */
export function snapValueDist(
  v: number,
  targets: number[],
  tolMm: number,
): { value: number; dist: number } {
  let best = v
  let bestDist = Infinity
  for (const t of targets) {
    const d = Math.abs(t - v)
    if (d <= tolMm && d <= bestDist) {
      best = t
      bestDist = d
    }
  }
  return { value: best, dist: bestDist }
}

export function snapValue(
  v: number,
  targets: number[],
  tolMm = SNAP_TOLERANCE_MM,
): number {
  return snapValueDist(v, targets, tolMm).value
}

export function snapRectTranslate(
  rect: RectMm,
  targetsX: number[],
  targetsY: number[],
  tolMm = SNAP_TOLERANCE_MM,
): RectMm {
  const candidatesX = [rect.xMm, rect.xMm + rect.wMm / 2, rect.xMm + rect.wMm]
  const candidatesY = [rect.yMm, rect.yMm + rect.hMm / 2, rect.yMm + rect.hMm]
  const dx = bestDelta(candidatesX, targetsX, tolMm)
  const dy = bestDelta(candidatesY, targetsY, tolMm)
  return { ...rect, xMm: rect.xMm + dx, yMm: rect.yMm + dy }
}

function bestDelta(candidates: number[], targets: number[], tolMm: number): number {
  let best = 0
  let bestAbs = tolMm
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

/**
 * 参考线吸附：posMm 吸附到画布边缘/中线、同轴其他参考线、对象边缘/中线；
 * gridStepMm>0 时叠加网格吸附并取更近者（与照片两路吸附同口径）。
 */
export function snapGuidePos(
  posMm: number,
  axis: GuideAxis,
  canvas: CanvasSpec,
  otherGuidePos: number[],
  others: RectMm[],
  gridStepMm: number | null,
  tolMm: number,
): number {
  const targets =
    axis === 'x'
      ? [0, canvas.widthMm / 2, canvas.widthMm]
      : [0, canvas.heightMm / 2, canvas.heightMm]
  targets.push(...otherGuidePos)
  for (const r of others) {
    if (axis === 'x') targets.push(r.xMm, r.xMm + r.wMm / 2, r.xMm + r.wMm)
    else targets.push(r.yMm, r.yMm + r.hMm / 2, r.yMm + r.hMm)
  }
  const { value: snapped, dist: edgeDist } = snapValueDist(posMm, targets, tolMm)
  if (gridStepMm != null && gridStepMm > 0) {
    const grid = Math.round(posMm / gridStepMm) * gridStepMm
    // 边缘未命中（dist=Infinity）时网格路兜底；命中时两路取更近
    if (edgeDist === Infinity || Math.abs(grid - posMm) < edgeDist) return grid
  }
  return snapped
}

/** 对齐命中线：吸附后矩形的候选线（左/水平中/右、顶/垂直中/底）与目标重合的轴线值 */
export function snapHitLines(
  rect: RectMm,
  targetsX: number[],
  targetsY: number[],
): { x: number[]; y: number[] } {
  const EPS = 1e-6
  const candX = [rect.xMm, rect.xMm + rect.wMm / 2, rect.xMm + rect.wMm]
  const candY = [rect.yMm, rect.yMm + rect.hMm / 2, rect.yMm + rect.hMm]
  const hit = (cands: number[], targets: number[]) =>
    targets.filter((t) => cands.some((c) => Math.abs(c - t) <= EPS))
  return {
    x: [...new Set(hit(candX, targetsX))],
    y: [...new Set(hit(candY, targetsY))],
  }
}

export function clampMinSize(rect: RectMm, minMm: number): RectMm {
  return { ...rect, wMm: Math.max(minMm, rect.wMm), hMm: Math.max(minMm, rect.hMm) }
}

/** 网格吸附：左上角对齐到最近的 gridStepMm 整数倍 */
export function snapGridTranslate(rect: RectMm, stepMm: number): RectMm {
  if (stepMm <= 0) return rect
  return {
    ...rect,
    xMm: Math.round(rect.xMm / stepMm) * stepMm,
    yMm: Math.round(rect.yMm / stepMm) * stepMm,
  }
}
