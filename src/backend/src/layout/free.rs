//! 自由排版辅助：吸附与边界钳制。rect 由前端拖拽产生，导出时原样使用
//! （允许越界出血），这里提供编辑过程中的吸附目标计算（前端 TS 镜像同一算法）。

use crate::model::{CanvasSpec, GuideAxis, RectMm};

pub const SNAP_TOLERANCE_MM: f64 = 0.5;
/// 屏幕像素容差：换算 mm = SNAP_TOLERANCE_PX / px_per_mm（缩放越小容差越大，PS 口径）。
pub const SNAP_TOLERANCE_PX: f64 = 5.0;

/// 返回吸附目标（其他对象边缘/中线 + 画布边界/中线），去重。
pub fn snap_targets(canvas: &CanvasSpec, others: &[RectMm]) -> Vec<f64> {
    let mut targets = vec![
        0.0,
        canvas.width_mm / 2.0,
        canvas.width_mm,
        0.0,
        canvas.height_mm / 2.0,
        canvas.height_mm,
    ];
    for r in others {
        targets.extend([
            r.x_mm,
            r.x_mm + r.w_mm / 2.0,
            r.right(),
            r.y_mm,
            r.y_mm + r.h_mm / 2.0,
            r.bottom(),
        ]);
    }
    targets.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    targets.dedup_by(|a, b| (*a - *b).abs() < 1e-9);
    targets
}

/// 单值吸附的命中结果：value 为吸附值（未命中原样），dist 为命中距离（未命中 Infinity）。
pub struct SnapValueHit {
    pub value: f64,
    pub dist: f64,
}

/// 单值吸附并返回命中距离：容差内取最近目标（并列取后出现者，与 snap_value 同规则）。
pub fn snap_value_dist(v: f64, targets: &[f64], tol_mm: f64) -> SnapValueHit {
    let mut best = v;
    let mut best_dist = f64::INFINITY;
    for t in targets {
        let d = (*t - v).abs();
        if d <= tol_mm && d <= best_dist {
            best = *t;
            best_dist = d;
        }
    }
    SnapValueHit {
        value: best,
        dist: best_dist,
    }
}

/// 单值吸附：容差内取最近目标，否则原样返回。
pub fn snap_value(v: f64, targets: &[f64], tol_mm: f64) -> f64 {
    snap_value_dist(v, targets, tol_mm).value
}

/// 矩形平移吸附：对左右/水平中线/右缘分别求吸附，取位移最小的一个统一平移。
pub fn snap_rect_translate(
    rect: &RectMm,
    targets_x: &[f64],
    targets_y: &[f64],
    tol_mm: f64,
) -> RectMm {
    let candidates_x = [rect.x_mm, rect.x_mm + rect.w_mm / 2.0, rect.right()];
    let candidates_y = [rect.y_mm, rect.y_mm + rect.h_mm / 2.0, rect.bottom()];

    let delta_x = best_delta(&candidates_x, targets_x, tol_mm);
    let delta_y = best_delta(&candidates_y, targets_y, tol_mm);

    RectMm {
        x_mm: rect.x_mm + delta_x,
        y_mm: rect.y_mm + delta_y,
        ..*rect
    }
}

fn best_delta(candidates: &[f64], targets: &[f64], tol_mm: f64) -> f64 {
    let mut best = (0.0, tol_mm);
    for c in candidates {
        for t in targets {
            let d = *t - *c;
            if d.abs() <= best.1 {
                best = (d, d.abs());
            }
        }
    }
    best.0
}

/// 参考线吸附：pos_mm 吸附到画布边缘/中线、同轴其他参考线、对象边缘/中线；
/// grid_step_mm 为 Some 时叠加网格吸附并取更近者（与照片两路吸附同口径）。
pub fn snap_guide_pos(
    pos_mm: f64,
    axis: GuideAxis,
    canvas: &CanvasSpec,
    other_guide_pos: &[f64],
    others: &[RectMm],
    grid_step_mm: Option<f64>,
    tol_mm: f64,
) -> f64 {
    let mut targets = match axis {
        GuideAxis::X => vec![0.0, canvas.width_mm / 2.0, canvas.width_mm],
        GuideAxis::Y => vec![0.0, canvas.height_mm / 2.0, canvas.height_mm],
    };
    targets.extend_from_slice(other_guide_pos);
    for r in others {
        match axis {
            GuideAxis::X => targets.extend([r.x_mm, r.x_mm + r.w_mm / 2.0, r.right()]),
            GuideAxis::Y => targets.extend([r.y_mm, r.y_mm + r.h_mm / 2.0, r.bottom()]),
        }
    }
    let hit = snap_value_dist(pos_mm, &targets, tol_mm);
    if let Some(step) = grid_step_mm {
        if step > 0.0 {
            let grid = (pos_mm / step).round() * step;
            // 边缘未命中（dist=Infinity）时网格路兜底；命中时两路取更近
            if hit.dist == f64::INFINITY || (grid - pos_mm).abs() < hit.dist {
                return grid;
            }
        }
    }
    hit.value
}

/// 对齐命中线：吸附后矩形的候选线（左/水平中/右、顶/垂直中/底）与目标重合的轴线值。
#[derive(Debug, PartialEq)]
pub struct SnapHitLines {
    pub x: Vec<f64>,
    pub y: Vec<f64>,
}

pub fn snap_hit_lines(rect: &RectMm, targets_x: &[f64], targets_y: &[f64]) -> SnapHitLines {
    const EPS: f64 = 1e-6;
    let cand_x = [rect.x_mm, rect.x_mm + rect.w_mm / 2.0, rect.right()];
    let cand_y = [rect.y_mm, rect.y_mm + rect.h_mm / 2.0, rect.bottom()];
    let hit = |cands: &[f64], targets: &[f64]| -> Vec<f64> {
        let mut out: Vec<f64> = targets
            .iter()
            .copied()
            .filter(|t| cands.iter().any(|c| (c - t).abs() <= EPS))
            .collect();
        out.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        out.dedup_by(|a, b| (*a - *b).abs() < EPS);
        out
    };
    SnapHitLines {
        x: hit(&cand_x, targets_x),
        y: hit(&cand_y, targets_y),
    }
}

/// 钳制尺寸为最小正值，避免零/负宽高拖垮导出。
pub fn clamp_min_size(rect: &RectMm, min_mm: f64) -> RectMm {
    RectMm {
        w_mm: rect.w_mm.max(min_mm),
        h_mm: rect.h_mm.max(min_mm),
        ..*rect
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn canvas() -> CanvasSpec {
        CanvasSpec {
            width_mm: 100.0,
            height_mm: 100.0,
            dpi: 300,
            background: "#FFFFFF".to_string(),
            bleed_mm: 0.0,
        }
    }

    fn rect(x: f64, y: f64, w: f64, h: f64) -> RectMm {
        RectMm {
            x_mm: x,
            y_mm: y,
            w_mm: w,
            h_mm: h,
        }
    }

    #[test]
    fn snap_within_tolerance_only() {
        assert_eq!(snap_value(10.2, &[10.0], SNAP_TOLERANCE_MM), 10.0);
        assert_eq!(snap_value(10.6, &[10.0], SNAP_TOLERANCE_MM), 10.6);
        assert_eq!(snap_value(10.0, &[], SNAP_TOLERANCE_MM), 10.0);
        // 动态容差：5px 在 pxPerMm=3.3 时 ≈1.5mm，原本 1.0mm 的偏差也能吸上
        assert_eq!(snap_value(11.0, &[10.0], SNAP_TOLERANCE_PX / 3.3), 10.0);
    }

    #[test]
    fn snap_picks_nearest_target() {
        assert_eq!(snap_value(20.3, &[10.0, 20.0], SNAP_TOLERANCE_MM), 20.0);
    }

    #[test]
    fn translate_snaps_edge_to_canvas_center() {
        // 左缘 49.7 → 画布中线 50，位移 +0.3
        let r = snap_rect_translate(
            &rect(49.7, 10.0, 20.0, 20.0),
            &[0.0, 50.0, 100.0],
            &[],
            SNAP_TOLERANCE_MM,
        );
        assert_eq!(r.x_mm, 50.0);
        assert_eq!(r.y_mm, 10.0);
    }

    #[test]
    fn targets_include_other_rect_edges() {
        let targets = snap_targets(&canvas(), &[rect(30.0, 40.0, 10.0, 10.0)]);
        assert!(targets.contains(&30.0));
        assert!(targets.contains(&35.0));
        assert!(targets.contains(&40.0));
    }

    #[test]
    fn clamp_min_size_keeps_position() {
        let r = clamp_min_size(&rect(5.0, 5.0, 0.0, -3.0), 1.0);
        assert_eq!((r.x_mm, r.y_mm, r.w_mm, r.h_mm), (5.0, 5.0, 1.0, 1.0));
    }

    // 与前端 TS 镜像同断言（layout.spec.ts「free 吸附对拍」）
    #[test]
    fn guide_snaps_to_canvas_center_other_guide_object_edge_and_grid() {
        let c = canvas();
        // 画布中线（100 宽 → 50）
        assert_eq!(
            snap_guide_pos(50.4, GuideAxis::X, &c, &[], &[], None, SNAP_TOLERANCE_MM),
            50.0
        );
        // 同轴其他参考线
        assert_eq!(
            snap_guide_pos(
                80.4,
                GuideAxis::X,
                &c,
                &[80.0],
                &[],
                None,
                SNAP_TOLERANCE_MM
            ),
            80.0
        );
        // 对象边缘
        assert_eq!(
            snap_guide_pos(
                30.3,
                GuideAxis::X,
                &c,
                &[],
                &[rect(30.0, 40.0, 10.0, 10.0)],
                None,
                SNAP_TOLERANCE_MM
            ),
            30.0
        );
        // 网格与目标取更近：49.6 距网格(50) 0.4、距中线(50) 0.4 → 同值；48.7 距网格(50) 1.3、距对象边缘 48.5 取 0.2
        assert_eq!(
            snap_guide_pos(
                48.7,
                GuideAxis::X,
                &c,
                &[],
                &[rect(47.5, 0.0, 1.0, 1.0)],
                Some(5.0),
                SNAP_TOLERANCE_MM
            ),
            48.5
        );
        // 网格兜底：容差内无边缘目标命中时吸到最近网格点
        assert_eq!(
            snap_guide_pos(
                72.3,
                GuideAxis::X,
                &c,
                &[],
                &[],
                Some(5.0),
                SNAP_TOLERANCE_MM
            ),
            70.0
        );
        // 容差外不动
        assert_eq!(
            snap_guide_pos(61.0, GuideAxis::X, &c, &[], &[], None, SNAP_TOLERANCE_MM),
            61.0
        );
    }

    #[test]
    fn hit_lines_report_snapped_candidates() {
        // 左缘吸到 30、右缘同时吸到 50（宽 20）：双竖线命中
        let r = snap_rect_translate(
            &rect(29.8, 10.0, 20.0, 20.0),
            &[30.0, 50.0],
            &[],
            SNAP_TOLERANCE_MM,
        );
        let hits = snap_hit_lines(&r, &[30.0, 50.0], &[0.0, 100.0]);
        assert_eq!(hits.x, vec![30.0, 50.0]);
        assert!(hits.y.is_empty());
        // 中线命中 + 无命中为空
        let r2 = snap_rect_translate(
            &rect(39.8, 10.0, 20.0, 20.0),
            &[50.0],
            &[],
            SNAP_TOLERANCE_MM,
        );
        let hits2 = snap_hit_lines(&r2, &[50.0], &[]);
        assert_eq!(hits2.x, vec![50.0]);
        // 未吸附时不报命中
        let hits3 = snap_hit_lines(&rect(33.0, 10.0, 20.0, 20.0), &[30.0, 50.0], &[]);
        assert!(hits3.x.is_empty());
    }
}
