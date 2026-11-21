//! 单张图像操作：EXIF 方向、翻转、旋转、色彩调整、归一化裁剪。

use std::path::Path;

use exif::{In, Reader, Tag};
use image::{imageops, DynamicImage, Rgb, RgbImage};

use crate::model::{Adjust, CropNorm};

/// 读取 JPEG/TIFF EXIF 方向值（1–8）；无 EXIF 或读取失败返回 None（视为方向 1）。
/// `image` crate 解码不应用 EXIF 方向，手机竖拍照必须手动修正。
pub fn orientation_from_exif(path: &Path) -> Option<u32> {
    let file = std::fs::File::open(path).ok()?;
    let mut buf = std::io::BufReader::new(file);
    let exif = Reader::new().read_from_container(&mut buf).ok()?;
    let field = exif.get_field(Tag::Orientation, In::PRIMARY)?;
    field.value.get_uint(0).filter(|v| (1..=8).contains(v))
}

/// 按 EXIF 方向值旋转/镜像图像（方向 1 原样）。
pub fn apply_orientation(img: DynamicImage, orientation: Option<u32>) -> DynamicImage {
    match orientation {
        Some(2) => img.fliph(),
        Some(3) => img.rotate180(),
        Some(4) => img.flipv(),
        Some(5) => img.fliph().rotate270(),
        Some(6) => img.rotate90(),
        Some(7) => img.fliph().rotate90(),
        Some(8) => img.rotate270(),
        _ => img,
    }
}

/// 水平/垂直翻转。
pub fn apply_flips(img: &RgbImage, flip_h: bool, flip_v: bool) -> RgbImage {
    let mut out = img.clone();
    if flip_h {
        out = imageops::flip_horizontal(&out);
    }
    if flip_v {
        out = imageops::flip_vertical(&out);
    }
    out
}

/// 顺时针旋转任意角度；90° 整数倍走 imageops 快速路径，其余双线性逆映射。
/// 旋转后画布外区域取边缘像素（后续 cover 合成会再裁剪）。
pub fn rotate_expand(img: &RgbImage, degrees: f64) -> RgbImage {
    let normalized = degrees.rem_euclid(360.0);
    match normalized.round() as u32 {
        0 => return img.clone(),
        90 => return imageops::rotate90(img),
        180 => return imageops::rotate180(img),
        270 => return imageops::rotate270(img),
        _ => {}
    }

    let rad = normalized.to_radians();
    let (w, h) = (img.width() as f64, img.height() as f64);
    let cos = rad.cos();
    let sin = rad.sin();
    let new_w = (w * cos.abs() + h * sin.abs()).round().max(1.0) as u32;
    let new_h = (w * sin.abs() + h * cos.abs()).round().max(1.0) as u32;

    let mut out = RgbImage::new(new_w, new_h);
    let cx = w / 2.0;
    let cy = h / 2.0;
    let ncx = new_w as f64 / 2.0;
    let ncy = new_h as f64 / 2.0;

    for ny in 0..new_h {
        for nx in 0..new_w {
            let dx = nx as f64 + 0.5 - ncx;
            let dy = ny as f64 + 0.5 - ncy;
            let sx = cos * dx + sin * dy + cx - 0.5;
            let sy = -sin * dx + cos * dy + cy - 0.5;
            *out.get_pixel_mut(nx, ny) = bilinear_edge(img, sx, sy);
        }
    }
    out
}

fn bilinear_edge(img: &RgbImage, x: f64, y: f64) -> Rgb<u8> {
    let max_x = img.width() as f64 - 1.0;
    let max_y = img.height() as f64 - 1.0;
    let x = x.clamp(0.0, max_x);
    let y = y.clamp(0.0, max_y);
    let x0 = x.floor().min(max_x - 1.0).max(0.0);
    let y0 = y.floor().min(max_y - 1.0).max(0.0);
    let fx = x - x0;
    let fy = y - y0;

    let p00 = img.get_pixel(x0 as u32, y0 as u32);
    let p10 = img.get_pixel((x0 + 1.0) as u32, y0 as u32);
    let p01 = img.get_pixel(x0 as u32, (y0 + 1.0) as u32);
    let p11 = img.get_pixel((x0 + 1.0) as u32, (y0 + 1.0) as u32);

    let mut px = Rgb([0u8; 3]);
    for c in 0..3 {
        let top = p00[c] as f64 * (1.0 - fx) + p10[c] as f64 * fx;
        let bottom = p01[c] as f64 * (1.0 - fx) + p11[c] as f64 * fx;
        px[c] = (top * (1.0 - fy) + bottom * fy).round() as u8;
    }
    px
}

/// 亮度/对比度/饱和度调整，全部为 1.0 时不动。顺序：亮度 → 对比度 → 饱和度。
pub fn apply_adjust(img: &mut RgbImage, adj: &Adjust) {
    if adj.brightness == 1.0 && adj.contrast == 1.0 && adj.saturation == 1.0 {
        return;
    }
    for px in img.pixels_mut() {
        let mut c = [
            px[0] as f32 / 255.0,
            px[1] as f32 / 255.0,
            px[2] as f32 / 255.0,
        ];
        for v in &mut c {
            *v = (*v * adj.brightness as f32 - 0.5) * adj.contrast as f32 + 0.5;
        }
        let luma = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        for v in &mut c {
            *v = luma + (*v - luma) * adj.saturation as f32;
        }
        px[0] = (c[0].clamp(0.0, 1.0) * 255.0).round() as u8;
        px[1] = (c[1].clamp(0.0, 1.0) * 255.0).round() as u8;
        px[2] = (c[2].clamp(0.0, 1.0) * 255.0).round() as u8;
    }
}

/// 按归一化窗口裁剪；窗口覆盖整图时原样返回。
pub fn crop_normalized(img: &RgbImage, crop: &CropNorm) -> RgbImage {
    let (w, h) = (img.width() as f64, img.height() as f64);
    let x = (crop.x.clamp(0.0, 1.0) * w).round() as u32;
    let y = (crop.y.clamp(0.0, 1.0) * h).round() as u32;
    let cw = ((crop.w.clamp(0.0, 1.0) * w).round() as u32).max(1);
    let ch = ((crop.h.clamp(0.0, 1.0) * h).round() as u32).max(1);
    if x == 0 && y == 0 && cw >= img.width() && ch >= img.height() {
        return img.clone();
    }
    let cw = cw.min(img.width() - x);
    let ch = ch.min(img.height() - y);
    imageops::crop_imm(img, x, y, cw.max(1), ch.max(1)).to_image()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn banded_image() -> RgbImage {
        // 200×100：左半红、右半蓝
        let mut img = RgbImage::new(200, 100);
        for y in 0..100 {
            for x in 0..100 {
                img.put_pixel(x, y, Rgb([255, 0, 0]));
            }
            for x in 100..200 {
                img.put_pixel(x, y, Rgb([0, 0, 255]));
            }
        }
        img
    }

    #[test]
    fn rotate_90_swaps_dimensions_and_moves_quadrants() {
        let out = rotate_expand(&banded_image(), 90.0);
        assert_eq!(out.dimensions(), (100, 200));
        // 顺时针 90°：原左下(红) → 新左上；原右下(蓝) → 新左下
        assert_eq!(*out.get_pixel(0, 0), Rgb([255, 0, 0]));
        assert_eq!(*out.get_pixel(0, 199), Rgb([0, 0, 255]));
    }

    #[test]
    fn rotate_45_expands_canvas() {
        let out = rotate_expand(&banded_image(), 45.0);
        assert!(out.width() > 100);
        assert_eq!(out.dimensions(), (212, 212));
    }

    #[test]
    fn flips_compose() {
        let img = banded_image();
        let flipped = apply_flips(&img, true, false);
        assert_eq!(*flipped.get_pixel(0, 0), Rgb([0, 0, 255]));
        let both = apply_flips(&img, true, true);
        // 横向色带垂直翻转不变，左右镜像后左缘恒为蓝
        assert_eq!(*both.get_pixel(0, 0), Rgb([0, 0, 255]));
        assert_eq!(*both.get_pixel(0, 99), Rgb([0, 0, 255]));
    }

    #[test]
    fn brightness_zero_makes_black() {
        let mut img = RgbImage::from_pixel(4, 4, Rgb([255, 255, 255]));
        apply_adjust(
            &mut img,
            &Adjust {
                brightness: 0.0,
                contrast: 1.0,
                saturation: 1.0,
            },
        );
        assert_eq!(*img.get_pixel(0, 0), Rgb([0, 0, 0]));
    }

    #[test]
    fn saturation_zero_grays_red() {
        let mut img = RgbImage::from_pixel(4, 4, Rgb([255, 0, 0]));
        apply_adjust(
            &mut img,
            &Adjust {
                brightness: 1.0,
                contrast: 1.0,
                saturation: 0.0,
            },
        );
        let px = img.get_pixel(0, 0);
        assert_eq!(px[0], px[1]);
        assert_eq!(px[1], px[2]);
    }

    #[test]
    fn crop_normalized_halves() {
        let img = banded_image();
        let out = crop_normalized(
            &img,
            &CropNorm {
                x: 0.0,
                y: 0.0,
                w: 0.5,
                h: 1.0,
            },
        );
        assert_eq!(out.dimensions(), (100, 100));
        assert_eq!(*out.get_pixel(99, 50), Rgb([255, 0, 0]));
    }

    #[test]
    fn full_window_crop_is_noop() {
        let img = banded_image();
        let out = crop_normalized(
            &img,
            &CropNorm {
                x: 0.0,
                y: 0.0,
                w: 1.0,
                h: 1.0,
            },
        );
        assert_eq!(out.dimensions(), img.dimensions());
    }
}
