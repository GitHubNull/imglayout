// 参考线绘制（纯函数）。坐标经 useCanvasView 换算，逻辑坐标毫米。
import type { useCanvasView } from '../../composables/useCanvasView'
import type { CanvasSpec, Guide, GuideAxis } from '../../types/layout'
import type { GuidesPalette } from '../../lib/canvasTheme'

type View = ReturnType<typeof useCanvasView>

/** 拖出中的参考线草稿 */
export interface GuideDraft {
  axis: GuideAxis
  posMm: number
}

export interface GuidesDrawState {
  guides: Guide[]
  selectedIds: string[]
  hoveredId: string | null
  draft: GuideDraft | null
  /** 正在拖动中的参考线 id */
  draggingId?: string | null
  /** 草稿/拖动中的参考线吸附在目标上时品红加粗 */
  draftSnapped?: boolean
}

function drawOne(
  ctx: CanvasRenderingContext2D,
  view: View,
  c: CanvasSpec,
  axis: GuideAxis,
  posMm: number,
  style: { color: string; width: number; dashed: boolean },
) {
  const b = c.bleedMm
  ctx.save()
  ctx.strokeStyle = style.color
  ctx.lineWidth = style.width
  if (style.dashed) ctx.setLineDash([4, 3])
  ctx.beginPath()
  if (axis === 'x') {
    const x = Math.round(view.screenX(posMm, b)) + 0.5
    ctx.moveTo(x, view.screenY(-b, b))
    ctx.lineTo(x, view.screenY(c.heightMm + b, b))
  } else {
    const y = Math.round(view.screenY(posMm, b)) + 0.5
    ctx.moveTo(view.screenX(-b, b), y)
    ctx.lineTo(view.screenX(c.widthMm + b, b), y)
  }
  ctx.stroke()
  ctx.restore()
}

/** 悬停/选中时在参考线末端画毫米标签（标尺读数口径：y 线 = heightMm − posMm） */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  view: View,
  c: CanvasSpec,
  axis: GuideAxis,
  posMm: number,
  color: string,
  pal: GuidesPalette,
) {
  const b = c.bleedMm
  const text = `${Math.round((axis === 'x' ? posMm : c.heightMm - posMm) * 10) / 10}mm`
  const x = axis === 'x' ? view.screenX(posMm, b) + 4 : view.screenX(-b, b) + 4
  const y = axis === 'x' ? view.screenY(-b, b) + 12 : view.screenY(posMm, b) - 5
  ctx.save()
  ctx.font = '10px sans-serif'
  const w = ctx.measureText(text).width
  ctx.fillStyle = pal.labelBg
  ctx.fillRect(x - 2, y - 10, w + 4, 13)
  ctx.fillStyle = color
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function drawGuides(
  ctx: CanvasRenderingContext2D,
  view: View,
  c: CanvasSpec,
  state: GuidesDrawState,
  pal: GuidesPalette,
) {
  const selected = new Set(state.selectedIds)
  for (const g of state.guides) {
    const isSel = selected.has(g.id)
    const isHover = state.hoveredId === g.id
    const snapped = state.draggingId === g.id && !!state.draftSnapped
    const color = snapped
      ? pal.snapped
      : isSel
        ? pal.selected
        : isHover
          ? pal.hover
          : pal.normal
    const width = snapped || isSel || isHover ? 2 : 1
    drawOne(ctx, view, c, g.axis, g.posMm, {
      color,
      width,
      dashed: !!g.locked && !isSel && !isHover,
    })
    if (isSel || isHover) drawLabel(ctx, view, c, g.axis, g.posMm, color, pal)
  }
  if (state.draft) {
    drawOne(ctx, view, c, state.draft.axis, state.draft.posMm, {
      color: state.draftSnapped ? pal.snapped : pal.draft,
      width: state.draftSnapped ? 2 : 1,
      dashed: false,
    })
  }
}
