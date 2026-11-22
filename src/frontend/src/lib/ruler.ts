// 标尺刻度步长：保证相邻主刻度在屏幕上至少间隔 MIN_TICK_PX 像素
const MIN_TICK_PX = 8

export function rulerSteps(pxPerMm: number): number {
  for (const s of [1, 2, 5, 10, 20, 50]) {
    if (s * pxPerMm >= MIN_TICK_PX) return s
  }
  return 50
}
