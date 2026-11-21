//! 规则网格：行×列等分，照片按序从左到右、从上到下填充；
//! 超出 rows×cols 容量的照片返回 None（不出现在版面中）。

use crate::model::{CanvasSpec, GridConfig, PhotoItem, RectMm};

pub fn layout_grid(
    canvas: &CanvasSpec,
    cfg: &GridConfig,
    items: &[PhotoItem],
) -> Vec<Option<RectMm>> {
    let cols = cfg.cols.max(1);
    let rows = cfg.rows.max(1);
    let capacity = rows as usize * cols as usize;

    let content_w = (canvas.width_mm - 2.0 * cfg.outer_mm).max(0.0);
    let content_h = (canvas.height_mm - 2.0 * cfg.outer_mm).max(0.0);
    let cols_f = cols as f64;
    let rows_f = rows as f64;
    let cell_w = if cols > 1 {
        (content_w - (cols_f - 1.0) * cfg.gap_mm) / cols_f
    } else {
        content_w
    }
    .max(0.0);
    let cell_h = if rows > 1 {
        (content_h - (rows_f - 1.0) * cfg.gap_mm) / rows_f
    } else {
        content_h
    }
    .max(0.0);

    items
        .iter()
        .enumerate()
        .map(|(i, _)| {
            if i >= capacity {
                return None;
            }
            let row = (i / cols as usize) as f64;
            let col = (i % cols as usize) as f64;
            Some(RectMm {
                x_mm: cfg.outer_mm + col * (cell_w + cfg.gap_mm),
                y_mm: cfg.outer_mm + row * (cell_h + cfg.gap_mm),
                w_mm: cell_w,
                h_mm: cell_h,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn canvas(w: f64, h: f64) -> CanvasSpec {
        CanvasSpec {
            width_mm: w,
            height_mm: h,
            dpi: 300,
            background: "#FFFFFF".to_string(),
            bleed_mm: 0.0,
        }
    }

    fn item(id: &str) -> PhotoItem {
        PhotoItem {
            id: id.to_string(),
            asset_id: id.to_string(),
            rect: RectMm {
                x_mm: 0.0,
                y_mm: 0.0,
                w_mm: 0.0,
                h_mm: 0.0,
            },
            rotation: 0.0,
            flip_h: false,
            flip_v: false,
            adjust: Default::default(),
            style: Default::default(),
            crop: None,
            ..PhotoItem::default()
        }
    }

    fn cfg(rows: u32, cols: u32, gap: f64, outer: f64) -> GridConfig {
        GridConfig {
            rows,
            cols,
            gap_mm: gap,
            outer_mm: outer,
            fill: Default::default(),
        }
    }

    #[test]
    fn divides_evenly_without_gap() {
        let items = vec![item("a"), item("b"), item("c"), item("d")];
        let rects = layout_grid(&canvas(100.0, 100.0), &cfg(2, 2, 0.0, 0.0), &items);
        assert_eq!(rects.len(), 4);
        let r = rects[3].unwrap();
        assert_eq!((r.x_mm, r.y_mm, r.w_mm, r.h_mm), (50.0, 50.0, 50.0, 50.0));
    }

    #[test]
    fn gap_and_outer_offset_positions() {
        let items = vec![item("a"), item("b"), item("c"), item("d")];
        let rects = layout_grid(&canvas(100.0, 100.0), &cfg(2, 2, 5.0, 10.0), &items);
        // 内容区 80×80，格 37.5×37.5
        assert_eq!(rects[0].unwrap().x_mm, 10.0);
        assert_eq!(rects[1].unwrap().x_mm, 52.5);
        assert_eq!(rects[2].unwrap().y_mm, 52.5);
        assert_eq!(rects[0].unwrap().w_mm, 37.5);
    }

    #[test]
    fn excess_items_are_none() {
        let items = vec![item("a"), item("b"), item("c")];
        let rects = layout_grid(&canvas(100.0, 100.0), &cfg(1, 2, 0.0, 0.0), &items);
        assert!(rects[2].is_none());
    }

    #[test]
    fn zero_gap_and_outer_full_bleed() {
        let items = vec![item("a"), item("b")];
        let rects = layout_grid(&canvas(100.0, 50.0), &cfg(1, 2, 0.0, 0.0), &items);
        assert_eq!(rects[1].unwrap().right(), 100.0);
    }
}
