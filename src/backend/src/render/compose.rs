//! cover/contain 适配与单张合成（圆角、描边），输出带 alpha 的覆盖层供贴到画布。

use image::{imageops, Rgb, RgbImage, Rgba, RgbaImage};

use crate::model::FillMode;

/// 解析 `#RGB` / `#RRGGBB`；非法值返回 None。
pub fn parse_hex_color(hex: &str) -> Option<Rgb<u8>> {
    let s = hex.strip_prefix('#')?;
    let expanded;
    let s = match s.len() {
        3 => {
            expanded = s.chars().flat_map(|c| [c, c]).collect::<String>();
            &expanded
        }
        6 => s,
        _ => return None,
    };
    let r = u8::from_str_radix(&s[0..2], 16).ok()?;
    let g = u8::from_str_radix(&s[2..4], 16).ok()?;
    let b = u8::from_str_radix(&s[4..6], 16).ok()?;
    Some(Rgb([r, g, b]))
}

/// cover：居中裁剪源图到目标宽高比，再 Lanczos 重采样到目标尺寸。
pub fn fit_cover(src: &RgbImage, box_w: u32, box_h: u32) -> RgbImage {
    let (sw, sh) = (src.width() as f64, src.height() as f64);
    let bw = box_w.max(1) as f64;
    let bh = box_h.max(1) as f64;
    let box_aspect = bw / bh;
    let src_aspect = sw / sh;

    let cropped = if src_aspect > box_aspect {
        let cw = (sh * box_aspect).round().max(1.0) as u32;
        let x = ((sw - cw as f64) / 2.0).round() as u32;
        imageops::crop_imm(
            src,
            x.min(src.width() - 1),
            0,
            cw.min(src.width()),
            src.height(),
        )
        .to_image()
    } else {
        let ch = (sw / box_aspect).round().max(1.0) as u32;
        let y = ((sh - ch as f64) / 2.0).round() as u32;
        imageops::crop_imm(
            src,
            0,
            y.min(src.height() - 1),
            src.width(),
            ch.min(src.height()),
        )
        .to_image()
    };
    imageops::resize(
        &cropped,
        box_w.max(1),
        box_h.max(1),
        imageops::FilterType::Lanczos3,
    )
}

/// contain：等比缩放到完全显示，居中贴在背景色盒子上。
pub fn fit_contain(src: &RgbImage, box_w: u32, box_h: u32, bg: Rgb<u8>) -> RgbImage {
    let bw = box_w.max(1);
    let bh = box_h.max(1);
    let scale = (bw as f64 / src.width() as f64).min(bh as f64 / src.height() as f64);
    let new_w = ((src.width() as f64 * scale).round() as u32).clamp(1, bw);
    let new_h = ((src.height() as f64 * scale).round() as u32).clamp(1, bh);
    let resized = imageops::resize(src, new_w, new_h, imageops::FilterType::Lanczos3);

    let mut out = RgbImage::from_pixel(bw, bh, bg);
    let x = (bw - new_w) / 2;
    let y = (bh - new_h) / 2;
    imageops::overlay(&mut out, &resized, x as i64, y as i64);
    out
}

/// 适配 + 圆角/描边，返回 RGBA 覆盖层（圆角外 alpha=0）。
pub fn compose_photo(
    src: RgbImage,
    box_px: (u32, u32),
    fill: FillMode,
    bg: Rgb<u8>,
    radius_px: u32,
    border_px: u32,
    border_color: Rgb<u8>,
) -> RgbaImage {
    let fitted = match fill {
        FillMode::Cover => fit_cover(&src, box_px.0, box_px.1),
        FillMode::Contain => fit_contain(&src, box_px.0, box_px.1, bg),
    };
    style_overlay(fitted, radius_px, border_px, border_color)
}

/// 逐像素圆角矩形 SDF：边界外 d>0，内部 d<0；描边取 [-border, 0] 区域。
fn style_overlay(
    img: RgbImage,
    radius_px: u32,
    border_px: u32,
    border_color: Rgb<u8>,
) -> RgbaImage {
    let (w, h) = img.dimensions();
    let r = radius_px.min(w / 2).min(h / 2) as f64;
    let mut out = RgbaImage::new(w, h);
    for y in 0..h {
        for x in 0..w {
            if rounded_rect_sdf(x, y, w, h, r) > 0.0 {
                continue;
            }
            let px = img.get_pixel(x, y);
            let rgba = if border_px > 0 && rounded_rect_sdf(x, y, w, h, r) >= -(border_px as f64) {
                Rgba([border_color[0], border_color[1], border_color[2], 255])
            } else {
                Rgba([px[0], px[1], px[2], 255])
            };
            out.put_pixel(x, y, rgba);
        }
    }
    out
}

fn rounded_rect_sdf(x: u32, y: u32, w: u32, h: u32, r: f64) -> f64 {
    let px = x as f64 + 0.5 - w as f64 / 2.0;
    let py = y as f64 + 0.5 - h as f64 / 2.0;
    let qx = px.abs() - (w as f64 / 2.0 - r);
    let qy = py.abs() - (h as f64 / 2.0 - r);
    let outside = (qx.max(0.0).powi(2) + qy.max(0.0).powi(2)).sqrt();
    qx.max(qy).min(0.0) + outside - r
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 300×100 竖向三色带：R | G | B，各 100 宽。
    fn banded3() -> RgbImage {
        let mut img = RgbImage::new(300, 100);
        for y in 0..100 {
            for x in 0..100 {
                img.put_pixel(x, y, Rgb([255, 0, 0]));
            }
            for x in 100..200 {
                img.put_pixel(x, y, Rgb([0, 255, 0]));
            }
            for x in 200..300 {
                img.put_pixel(x, y, Rgb([0, 0, 255]));
            }
        }
        img
    }

    #[test]
    fn cover_crops_center_band() {
        let out = fit_cover(&banded3(), 100, 100);
        assert_eq!(out.dimensions(), (100, 100));
        assert_eq!(*out.get_pixel(0, 0), Rgb([0, 255, 0]));
        assert_eq!(*out.get_pixel(50, 50), Rgb([0, 255, 0]));
        assert_eq!(*out.get_pixel(99, 99), Rgb([0, 255, 0]));
    }

    #[test]
    fn contain_letterboxes_with_background() {
        let out = fit_contain(&banded3(), 100, 100, Rgb([255, 255, 255]));
        assert_eq!(*out.get_pixel(50, 10), Rgb([255, 255, 255]));
        assert_eq!(*out.get_pixel(50, 50), Rgb([0, 255, 0]));
        assert_eq!(*out.get_pixel(50, 90), Rgb([255, 255, 255]));
    }

    #[test]
    fn parse_hex_variants() {
        assert_eq!(parse_hex_color("#FF0000"), Some(Rgb([255, 0, 0])));
        assert_eq!(parse_hex_color("#f00"), Some(Rgb([255, 0, 0])));
        assert_eq!(parse_hex_color("FF0000"), None);
        assert_eq!(parse_hex_color("#GG0000"), None);
    }

    #[test]
    fn radius_cuts_corners_and_border_strokes_edge() {
        let img = RgbImage::from_pixel(20, 20, Rgb([255, 0, 0]));
        let out = compose_photo(
            img,
            (20, 20),
            FillMode::Cover,
            Rgb([255, 255, 255]),
            10,
            2,
            Rgb([255, 255, 255]),
        );
        assert_eq!(out.get_pixel(0, 0)[3], 0);
        assert_eq!(*out.get_pixel(10, 0), Rgba([255, 255, 255, 255]));
        assert_eq!(*out.get_pixel(10, 10), Rgba([255, 0, 0, 255]));
    }
}
