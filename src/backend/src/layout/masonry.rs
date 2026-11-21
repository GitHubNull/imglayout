//! 瀑布流：列宽等分；每张照片按（裁剪后）宽高比定框高，逐张放入当前最短的列。
//! 框高由内容决定，因此只有 cover 语义：照片等比缩放填满自己的框，无留白。

use crate::model::{CanvasSpec, MasonryConfig, PhotoItem, RectMm};

/// `items` 每项附带原图像素宽高（AssetEntry 登记值），宽高比按 crop 窗口折算。
pub fn layout_masonry(
    canvas: &CanvasSpec,
    cfg: &MasonryConfig,
    items: &[(&PhotoItem, (u32, u32))],
) -> Vec<RectMm> {
    let columns = cfg.columns.max(1);
    let content_w = (canvas.width_mm - 2.0 * cfg.outer_mm).max(0.0);
    let col_w = if columns > 1 {
        (content_w - (columns as f64 - 1.0) * cfg.gap_mm) / columns as f64
    } else {
        content_w
    }
    .max(0.0);

    let mut col_heights = vec![cfg.outer_mm; columns as usize];
    let mut rects = Vec::with_capacity(items.len());

    for (item, (src_w, src_h)) in items {
        let aspect = cropped_aspect(item, *src_w, *src_h);
        let box_h = if aspect > 0.0 { col_w / aspect } else { col_w };

        let (col_idx, _) = col_heights
            .iter()
            .enumerate()
            .min_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or((0, &cfg.outer_mm));

        let x = cfg.outer_mm + col_idx as f64 * (col_w + cfg.gap_mm);
        let y = col_heights[col_idx];
        rects.push(RectMm {
            x_mm: x,
            y_mm: y,
            w_mm: col_w,
            h_mm: box_h,
        });
        col_heights[col_idx] += box_h + cfg.gap_mm;
    }

    rects
}

/// 照片有效区域宽高比：优先按 crop 窗口折算，否则用整图。
fn cropped_aspect(item: &PhotoItem, src_w: u32, src_h: u32) -> f64 {
    match item.crop {
        Some(c) if c.w > 0.0 && c.h > 0.0 => (c.w * src_w as f64) / (c.h * src_h as f64),
        _ if src_h > 0 => src_w as f64 / src_h as f64,
        _ => 1.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{CropNorm, Style};

    fn canvas(w: f64) -> CanvasSpec {
        CanvasSpec {
            width_mm: w,
            height_mm: 1000.0,
            dpi: 300,
            background: "#FFFFFF".to_string(),
            bleed_mm: 0.0,
        }
    }

    fn item(crop: Option<CropNorm>) -> PhotoItem {
        PhotoItem {
            id: "a".to_string(),
            asset_id: "a".to_string(),
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
            style: Style::default(),
            crop,
        }
    }

    fn cfg(columns: u32) -> MasonryConfig {
        MasonryConfig {
            columns,
            gap_mm: 0.0,
            outer_mm: 0.0,
        }
    }

    #[test]
    fn fills_shortest_column() {
        // 100 宽 2 列 → 列宽 50；图1 1:1 → 高 50；图2 2:1 → 高 25，进第 2 列；图3 1:1 进第 2 列（当前 25 < 50）
        let square = item(None);
        let wide = item(None);
        let items = vec![
            (&square, (100, 100)),
            (&wide, (200, 100)),
            (&square, (100, 100)),
        ];
        let rects = layout_masonry(&canvas(100.0), &cfg(2), &items);
        assert_eq!(rects[0].x_mm, 0.0);
        assert_eq!(
            (rects[1].x_mm, rects[1].y_mm, rects[1].h_mm),
            (50.0, 0.0, 25.0)
        );
        assert_eq!((rects[2].x_mm, rects[2].y_mm), (50.0, 25.0));
    }

    #[test]
    fn crop_window_changes_aspect() {
        // 原图 400×100（4:1），裁剪窗口取左半 0.25 宽 → 有效 1:1
        let cropped = item(Some(CropNorm {
            x: 0.0,
            y: 0.0,
            w: 0.25,
            h: 1.0,
        }));
        let items = vec![(&cropped, (400, 100))];
        let rects = layout_masonry(&canvas(50.0), &cfg(1), &items);
        assert_eq!(rects[0].h_mm, 50.0);
    }

    #[test]
    fn gap_and_outer_are_respected() {
        let first = item(None);
        let second = item(None);
        let items = vec![(&first, (100, 100)), (&second, (100, 100))];
        let rects = layout_masonry(
            &canvas(105.0),
            &MasonryConfig {
                columns: 2,
                gap_mm: 5.0,
                outer_mm: 0.0,
            },
            &items,
        );
        assert_eq!(rects[0].w_mm, 50.0);
        assert_eq!(rects[1].x_mm, 55.0);
    }
}
