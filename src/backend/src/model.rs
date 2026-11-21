//! LayoutDoc 数据模型，前后端共用 schema（见 doc/layout-schema.md）。
//! 几何量一律为毫米；DPI 只在导出时换算像素：px = mm / 25.4 × dpi。

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LayoutDoc {
    #[serde(default = "default_version")]
    pub version: u32,
    pub canvas: CanvasSpec,
    pub mode: LayoutMode,
    pub grid: Option<GridConfig>,
    pub masonry: Option<MasonryConfig>,
    pub items: Vec<PhotoItem>,
}

fn default_version() -> u32 {
    1
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CanvasSpec {
    pub width_mm: f64,
    pub height_mm: f64,
    pub dpi: u32,
    pub background: String,
    #[serde(default)]
    pub bleed_mm: f64,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LayoutMode {
    Grid,
    Masonry,
    Free,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GridConfig {
    pub rows: u32,
    pub cols: u32,
    #[serde(default)]
    pub gap_mm: f64,
    #[serde(default)]
    pub outer_mm: f64,
    #[serde(default)]
    pub fill: FillMode,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MasonryConfig {
    pub columns: u32,
    #[serde(default)]
    pub gap_mm: f64,
    #[serde(default)]
    pub outer_mm: f64,
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FillMode {
    #[default]
    Cover,
    Contain,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PhotoItem {
    pub id: String,
    pub asset_id: String,
    pub rect: RectMm,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default)]
    pub flip_h: bool,
    #[serde(default)]
    pub flip_v: bool,
    #[serde(default)]
    pub adjust: Adjust,
    #[serde(default)]
    pub style: Style,
    #[serde(default)]
    pub crop: Option<CropNorm>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RectMm {
    pub x_mm: f64,
    pub y_mm: f64,
    pub w_mm: f64,
    pub h_mm: f64,
}

impl RectMm {
    pub fn right(&self) -> f64 {
        self.x_mm + self.w_mm
    }

    pub fn bottom(&self) -> f64 {
        self.y_mm + self.h_mm
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Adjust {
    #[serde(default = "unit_value")]
    pub brightness: f64,
    #[serde(default = "unit_value")]
    pub contrast: f64,
    #[serde(default = "unit_value")]
    pub saturation: f64,
}

impl Default for Adjust {
    fn default() -> Self {
        Self {
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0,
        }
    }
}

fn unit_value() -> f64 {
    1.0
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Style {
    #[serde(default)]
    pub radius_mm: f64,
    #[serde(default)]
    pub border_width_mm: f64,
    #[serde(default = "default_border_color")]
    pub border_color: String,
}

impl Default for Style {
    fn default() -> Self {
        Self {
            radius_mm: 0.0,
            border_width_mm: 0.0,
            border_color: default_border_color(),
        }
    }
}

fn default_border_color() -> String {
    "#000000".to_string()
}

/// 0..1 归一化裁剪窗口（作用于当前图像，即旋转/翻转之后）。
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
pub struct CropNorm {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetEntry {
    pub asset_id: String,
    pub path: String,
    #[serde(default)]
    pub thumb_path: String,
    pub width_px: u32,
    pub height_px: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_uses_camel_case() {
        let doc = LayoutDoc {
            version: 1,
            canvas: CanvasSpec {
                width_mm: 254.0,
                height_mm: 381.0,
                dpi: 300,
                background: "#FFFFFF".to_string(),
                bleed_mm: 3.0,
            },
            mode: LayoutMode::Grid,
            grid: None,
            masonry: None,
            items: vec![],
        };
        let json = serde_json::to_value(&doc).unwrap();
        assert!(json["canvas"]["widthMm"].is_number());
        assert!(json["canvas"]["bleedMm"].is_number());
    }

    #[test]
    fn photo_item_defaults() {
        let item: PhotoItem = serde_json::from_str(
            r#"{"id":"a","assetId":"b","rect":{"xMm":0,"yMm":0,"wMm":10,"hMm":10}}"#,
        )
        .unwrap();
        assert_eq!(item.adjust, Adjust::default());
        assert!(!item.flip_h);
        assert!(item.crop.is_none());
    }
}
