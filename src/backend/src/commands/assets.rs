//! 照片导入：读取尺寸、生成 ≤2000px 预览缩略图（应用 EXIF 方向），登记 AssetEntry。

use std::fs;
use std::path::{Path, PathBuf};

use image::imageops::FilterType;
use tauri::{AppHandle, Manager};

use crate::model::AssetEntry;
use crate::render::ops;

const THUMB_MAX_EDGE: u32 = 2000;
const THUMB_QUALITY: u8 = 85;

#[tauri::command]
pub async fn import_assets(app: AppHandle, paths: Vec<String>) -> Result<ImportResult, String> {
    let thumbs_dir = thumbs_dir(&app)?;
    Ok(import_many(&thumbs_dir, paths))
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub entries: Vec<AssetEntry>,
    /// 逐文件错误（坏图/不支持格式等），不阻塞其余照片导入
    pub errors: Vec<String>,
}

/// 逐张导入：单张失败仅记错误，其余照常导入
pub fn import_many(thumbs_dir: &Path, paths: Vec<String>) -> ImportResult {
    let mut entries = Vec::with_capacity(paths.len());
    let mut errors = Vec::new();
    for path in &paths {
        match import_one(thumbs_dir, path) {
            Ok(entry) => entries.push(entry),
            Err(e) => errors.push(e),
        }
    }
    ImportResult { entries, errors }
}

/// 按 EXIF 方向修正登记尺寸：5/6/7/8 = 90°/270° 旋转场景，宽高互换。
/// 缩略图与导出都按方向旋转后的图像处理，登记尺寸必须同口径，否则 masonry 比例颠倒。
fn dims_for_orientation(width: u32, height: u32, orientation: Option<u32>) -> (u32, u32) {
    match orientation {
        Some(5..=8) => (height, width),
        _ => (width, height),
    }
}

pub fn thumbs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位应用数据目录: {e}"))?
        .join("thumbs");
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建缩略图目录: {e}"))?;
    Ok(dir)
}

/// 缩略图文件名 = asset_id.jpg，导入与项目加载共用同一规则。
pub fn thumb_path(thumbs_dir: &Path, asset_id: &str) -> PathBuf {
    thumbs_dir.join(format!("{asset_id}.jpg"))
}

fn import_one(thumbs_dir: &Path, path: &str) -> Result<AssetEntry, String> {
    let orientation = ops::orientation_from_exif(Path::new(path));
    let (w, h) =
        image::image_dimensions(path).map_err(|e| format!("读取图片尺寸失败 {path}: {e}"))?;
    let (width_px, height_px) = dims_for_orientation(w, h, orientation);
    let asset_id = uuid::Uuid::new_v4().to_string();
    let thumb = thumb_path(thumbs_dir, &asset_id);

    let dyn_img = image::open(path).map_err(|e| format!("图片解码失败 {path}: {e}"))?;
    let oriented = ops::apply_orientation(dyn_img, orientation);
    let rgb = oriented.to_rgb8();
    let (w, h) = (rgb.width(), rgb.height());
    let scale = (THUMB_MAX_EDGE as f64 / w as f64)
        .min(THUMB_MAX_EDGE as f64 / h as f64)
        .min(1.0);
    let thumb_img = if scale < 1.0 {
        image::imageops::resize(
            &rgb,
            ((w as f64 * scale).round() as u32).max(1),
            ((h as f64 * scale).round() as u32).max(1),
            FilterType::Lanczos3,
        )
    } else {
        rgb
    };
    save_thumb_jpeg(&thumb_img, &thumb)?;

    Ok(AssetEntry {
        asset_id,
        path: path.to_string(),
        thumb_path: thumb.to_string_lossy().to_string(),
        width_px,
        height_px,
    })
}

/// 项目加载时补齐缺失的缩略图（原图还在但 thumb 被清理的情况）。
pub fn ensure_thumbnail(app: &AppHandle, entry: &AssetEntry) -> Result<(), String> {
    if Path::new(&entry.thumb_path).exists() {
        return Ok(());
    }
    let thumbs_dir = thumbs_dir(app)?;
    let thumb = thumb_path(&thumbs_dir, &entry.asset_id);
    let dyn_img =
        image::open(&entry.path).map_err(|e| format!("图片解码失败 {}: {e}", entry.path))?;
    let oriented =
        ops::apply_orientation(dyn_img, ops::orientation_from_exif(Path::new(&entry.path)));
    save_thumb_jpeg(&oriented.to_rgb8(), &thumb)
}

fn save_thumb_jpeg(img: &image::RgbImage, path: &Path) -> Result<(), String> {
    let file =
        fs::File::create(path).map_err(|e| format!("缩略图写入失败 {}: {e}", path.display()))?;
    let mut buf = std::io::BufWriter::new(file);
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, THUMB_QUALITY);
    encoder
        .encode_image(&image::DynamicImage::ImageRgb8(img.clone()))
        .map_err(|e| format!("缩略图编码失败 {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thumb_path_uses_asset_id() {
        let dir = Path::new("/tmp/x");
        assert_eq!(thumb_path(dir, "abc-123"), Path::new("/tmp/x/abc-123.jpg"));
    }

    #[test]
    fn dims_for_orientation_swaps_on_rotated_exif() {
        assert_eq!(dims_for_orientation(4032, 3024, Some(6)), (3024, 4032));
        assert_eq!(dims_for_orientation(4032, 3024, Some(8)), (3024, 4032));
        assert_eq!(dims_for_orientation(4032, 3024, Some(5)), (3024, 4032));
        assert_eq!(dims_for_orientation(4032, 3024, Some(1)), (4032, 3024));
        assert_eq!(dims_for_orientation(4032, 3024, None), (4032, 3024));
    }

    #[test]
    fn import_many_continues_on_single_failure() {
        let dir = tempfile::tempdir().unwrap();
        let good = dir.path().join("good.jpg");
        let img = image::RgbImage::from_pixel(8, 6, image::Rgb([10, 120, 30]));
        let mut buf = Vec::new();
        image::codecs::jpeg::JpegEncoder::new(&mut buf)
            .encode_image(&image::DynamicImage::ImageRgb8(img))
            .unwrap();
        fs::write(&good, &buf).unwrap();

        let result = import_many(
            dir.path(),
            vec![
                good.to_string_lossy().to_string(),
                "/nonexistent/broken.jpg".to_string(),
            ],
        );
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].width_px, 8);
        assert_eq!(result.entries[0].height_px, 6);
        assert_eq!(result.errors.len(), 1);
        assert!(result.errors[0].contains("broken.jpg"));
    }
}
