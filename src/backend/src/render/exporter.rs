//! 导出编排：按 LayoutDoc 把照片合成到画布并编码输出。
//! 串行逐张处理控制内存峰值；progress 回调按张数回报进度。

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use image::{imageops, DynamicImage, Rgb, RgbImage, Rgba, RgbaImage};

use crate::layout::grid::layout_grid;
use crate::layout::masonry::layout_masonry;
use crate::model::{AssetEntry, FillMode, LayoutDoc, LayoutMode, PhotoItem, RectMm};
use crate::render::compose::{compose_photo, parse_hex_color};
use crate::render::ops;
use crate::units::{canvas_px_size, mm_to_px};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExportFormat {
    Jpeg,
    Png,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ExportOptions {
    pub format: ExportFormat,
    pub quality: u8,
}

impl Default for ExportOptions {
    fn default() -> Self {
        Self {
            format: ExportFormat::Jpeg,
            quality: 95,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ExportError {
    #[error("布局配置缺失: {0}")]
    ConfigMissing(&'static str),
    #[error("找不到照片资源: {0}")]
    AssetMissing(String),
    #[error("图片读取失败 {path}: {source}")]
    Decode {
        path: String,
        #[source]
        source: image::ImageError,
    },
    #[error("文件写入失败 {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("图像编码失败: {0}")]
    Encode(#[from] image::ImageError),
}

pub fn export_layout(
    doc: &LayoutDoc,
    assets: &HashMap<String, AssetEntry>,
    out_path: &Path,
    opts: &ExportOptions,
    progress: &dyn Fn(usize, usize),
) -> Result<(), ExportError> {
    let (out_w, out_h) = canvas_px_size(&doc.canvas);
    let bg = parse_hex_color(&doc.canvas.background).unwrap_or(Rgb([255, 255, 255]));
    let mut canvas = RgbaImage::from_pixel(out_w, out_h, Rgba([bg[0], bg[1], bg[2], 255]));

    let rects = compute_rects(doc, assets)?;
    let total = doc.items.len();

    for (idx, (item, rect)) in doc.items.iter().zip(rects.iter()).enumerate() {
        let Some(rect) = rect else {
            progress(idx + 1, total);
            continue;
        };
        let asset = assets
            .get(&item.asset_id)
            .ok_or_else(|| ExportError::AssetMissing(item.asset_id.clone()))?;
        let prepared = prepare_photo(&asset.path, item)?;

        let fill = fill_for(doc);
        let overlay = compose_photo(
            prepared,
            (
                mm_to_px(rect.w_mm, doc.canvas.dpi).max(1),
                mm_to_px(rect.h_mm, doc.canvas.dpi).max(1),
            ),
            fill,
            bg,
            mm_to_px(item.style.radius_mm, doc.canvas.dpi),
            mm_to_px(item.style.border_width_mm, doc.canvas.dpi),
            parse_hex_color(&item.style.border_color).unwrap_or(Rgb([0, 0, 0])),
        );

        let scale = doc.canvas.dpi as f64 / 25.4;
        let x = ((rect.x_mm + doc.canvas.bleed_mm) * scale).round() as i64;
        let y = ((rect.y_mm + doc.canvas.bleed_mm) * scale).round() as i64;
        imageops::overlay(&mut canvas, &overlay, x, y);
        progress(idx + 1, total);
    }

    write_output(&canvas, out_path, opts)
}

/// 各模式排版结果；grid 超出容量的照片为 None。
fn compute_rects(
    doc: &LayoutDoc,
    assets: &HashMap<String, AssetEntry>,
) -> Result<Vec<Option<RectMm>>, ExportError> {
    match doc.mode {
        LayoutMode::Grid => {
            let cfg = doc.grid.ok_or(ExportError::ConfigMissing("grid"))?;
            Ok(layout_grid(&doc.canvas, &cfg, &doc.items))
        }
        LayoutMode::Masonry => {
            let cfg = doc.masonry.ok_or(ExportError::ConfigMissing("masonry"))?;
            let mut pairs = Vec::with_capacity(doc.items.len());
            for item in &doc.items {
                let asset = assets
                    .get(&item.asset_id)
                    .ok_or_else(|| ExportError::AssetMissing(item.asset_id.clone()))?;
                pairs.push((item, (asset.width_px, asset.height_px)));
            }
            Ok(layout_masonry(&doc.canvas, &cfg, &pairs)
                .into_iter()
                .map(Some)
                .collect())
        }
        LayoutMode::Free => Ok(doc.items.iter().map(|i| Some(i.rect)).collect()),
    }
}

/// grid 模式下用配置的 fill；masonry / free 恒为 cover（照片填满自己的框）。
fn fill_for(doc: &LayoutDoc) -> FillMode {
    match doc.mode {
        LayoutMode::Grid => doc.grid.map(|g| g.fill).unwrap_or_default(),
        LayoutMode::Masonry | LayoutMode::Free => FillMode::Cover,
    }
}

/// 解码 → EXIF 方向 → 翻转 → 旋转 → 色彩调整 → 归一化裁剪。
fn prepare_photo(path: &str, item: &PhotoItem) -> Result<RgbImage, ExportError> {
    let dyn_img = image::open(path).map_err(|source| ExportError::Decode {
        path: path.to_string(),
        source,
    })?;
    let oriented = ops::apply_orientation(dyn_img, ops::orientation_from_exif(Path::new(path)));
    let flipped = ops::apply_flips(&oriented.to_rgb8(), item.flip_h, item.flip_v);
    let rotated = ops::rotate_expand(&flipped, item.rotation);
    let mut adjusted = rotated;
    ops::apply_adjust(&mut adjusted, &item.adjust);
    Ok(match &item.crop {
        Some(c) => ops::crop_normalized(&adjusted, c),
        None => adjusted,
    })
}

fn write_output(
    canvas: &RgbaImage,
    out_path: &Path,
    opts: &ExportOptions,
) -> Result<(), ExportError> {
    if let Some(parent) = out_path.parent() {
        fs::create_dir_all(parent).map_err(|source| ExportError::Io {
            path: parent.display().to_string(),
            source,
        })?;
    }
    match opts.format {
        ExportFormat::Jpeg => {
            let rgb = DynamicImage::ImageRgba8(canvas.clone()).to_rgb8();
            let file = fs::File::create(out_path).map_err(|source| ExportError::Io {
                path: out_path.display().to_string(),
                source,
            })?;
            let mut buf = std::io::BufWriter::new(file);
            let mut encoder =
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, opts.quality);
            encoder.encode_image(&DynamicImage::ImageRgb8(rgb))?;
        }
        ExportFormat::Png => {
            image::save_buffer(
                out_path,
                canvas,
                canvas.width(),
                canvas.height(),
                image::ColorType::Rgba8,
            )?;
        }
    }
    Ok(())
}
