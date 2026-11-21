//! 单位换算：毫米 ⇄ 像素。唯一换算公式：px = mm / 25.4 × dpi。

use crate::model::CanvasSpec;

/// 毫米转像素（四舍五入）。
pub fn mm_to_px(mm: f64, dpi: u32) -> u32 {
    (mm / 25.4 * dpi as f64).round().max(0.0) as u32
}

/// 导出画布像素尺寸（含出血外扩）。
pub fn canvas_px_size(canvas: &CanvasSpec) -> (u32, u32) {
    (
        mm_to_px(canvas.width_mm + 2.0 * canvas.bleed_mm, canvas.dpi),
        mm_to_px(canvas.height_mm + 2.0 * canvas.bleed_mm, canvas.dpi),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mm_to_px_rounds() {
        assert_eq!(mm_to_px(25.4, 300), 300);
        assert_eq!(mm_to_px(89.0, 300), 1051);
        assert_eq!(mm_to_px(127.0, 300), 1500);
    }

    #[test]
    fn canvas_size_includes_bleed() {
        let canvas = CanvasSpec {
            width_mm: 254.0,
            height_mm: 381.0,
            dpi: 300,
            background: "#FFFFFF".to_string(),
            bleed_mm: 3.0,
        };
        assert_eq!(canvas_px_size(&canvas), (3071, 4571));
    }
}
