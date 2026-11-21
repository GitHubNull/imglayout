//! 自由排版辅助：吸附与边界钳制。rect 由前端拖拽产生，导出时原样使用
//! （允许越界出血），这里提供编辑过程中的吸附目标计算（前端 TS 镜像同一算法）。

use crate::model::{CanvasSpec, RectMm};

pub const SNAP_TOLERANCE_MM: f64 = 0.5;

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

/// 单值吸附：容差内取最近目标，否则原样返回。
pub fn snap_value(v: f64, targets: &[f64]) -> f64 {
    let mut best = v;
    let mut best_dist = SNAP_TOLERANCE_MM;
    for t in targets {
        let d = (*t - v).abs();
        if d <= best_dist {
            best_dist = d;
            best = *t;
        }
    }
    best
}

/// 矩形平移吸附：对左右/水平中线/右缘分别求吸附，取位移最小的一个统一平移。
pub fn snap_rect_translate(rect: &RectMm, targets_x: &[f64], targets_y: &[f64]) -> RectMm {
    let candidates_x = [rect.x_mm, rect.x_mm + rect.w_mm / 2.0, rect.right()];
    let candidates_y = [rect.y_mm, rect.y_mm + rect.h_mm / 2.0, rect.bottom()];

    let delta_x = best_delta(&candidates_x, targets_x);
    let delta_y = best_delta(&candidates_y, targets_y);

    RectMm {
        x_mm: rect.x_mm + delta_x,
        y_mm: rect.y_mm + delta_y,
        ..*rect
    }
}

fn best_delta(candidates: &[f64], targets: &[f64]) -> f64 {
    let mut best = (0.0, SNAP_TOLERANCE_MM);
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
        assert_eq!(snap_value(10.2, &[10.0]), 10.0);
        assert_eq!(snap_value(10.6, &[10.0]), 10.6);
        assert_eq!(snap_value(10.0, &[]), 10.0);
    }

    #[test]
    fn snap_picks_nearest_target() {
        assert_eq!(snap_value(20.3, &[10.0, 20.0]), 20.0);
    }

    #[test]
    fn translate_snaps_edge_to_canvas_center() {
        // 左缘 49.7 → 画布中线 50，位移 +0.3
        let r = snap_rect_translate(&rect(49.7, 10.0, 20.0, 20.0), &[0.0, 50.0, 100.0], &[]);
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
}
