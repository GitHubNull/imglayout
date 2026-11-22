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
    /// 自由布局组合；旧文档无该字段时按空数组处理。
    #[serde(default)]
    pub groups: Vec<Group>,
    /// 参考线；旧文档无该字段时按空数组处理。
    #[serde(default)]
    pub guides: Vec<Guide>,
    pub items: Vec<PhotoItem>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
}

/// 参考线方向：X=竖直参考线（定 x 坐标），Y=水平参考线（定 y 坐标）。
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GuideAxis {
    X,
    Y,
}

/// 参考线；pos_mm 为距成品左缘(X)/顶缘(Y)的毫米值，与 item rect 同口径。
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Guide {
    pub id: String,
    pub axis: GuideAxis,
    pub pos_mm: f64,
    /// 锁定后不可拖动/删除。
    #[serde(default)]
    pub locked: bool,
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
    /// 隐藏层：预览不绘制、导出跳过、画布不可点选。
    #[serde(default = "default_true")]
    pub visible: bool,
    /// 0..1，整层（含边框）与背景混合的比例。
    #[serde(default = "unit_value")]
    pub opacity: f64,
    /// 锁定层：画布上禁止移动/缩放/旋转/微调/删除，面板仍可操作。
    #[serde(default)]
    pub locked: bool,
    /// 图层自定义名；None 回退为文件名。
    #[serde(default)]
    pub name: Option<String>,
    /// 所属组合 id；None 表示未组合。
    #[serde(default)]
    pub group_id: Option<String>,
}

impl Default for PhotoItem {
    fn default() -> Self {
        Self {
            id: String::new(),
            asset_id: String::new(),
            rect: RectMm::default(),
            rotation: 0.0,
            flip_h: false,
            flip_v: false,
            adjust: Adjust::default(),
            style: Style::default(),
            crop: None,
            visible: true,
            opacity: 1.0,
            locked: false,
            name: None,
            group_id: None,
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq)]
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
            groups: vec![],
            guides: vec![],
            items: vec![],
        };
        let json = serde_json::to_value(&doc).unwrap();
        assert!(json["canvas"]["widthMm"].is_number());
        assert!(json["canvas"]["bleedMm"].is_number());
        assert!(json["guides"].is_array());
    }

    #[test]
    fn legacy_doc_without_groups_field() {
        // 旧项目文件没有 groups / groupId 字段：反序列化须成功且按空组合处理
        let doc: LayoutDoc = serde_json::from_str(
            r##"{"version":1,"canvas":{"widthMm":297,"heightMm":210,"dpi":300,"background":"#FFFFFF","bleedMm":0},
                "mode":"free","items":[{"id":"a","assetId":"b","rect":{"xMm":0,"yMm":0,"wMm":10,"hMm":10}}]}"##,
        )
        .unwrap();
        assert!(doc.groups.is_empty());
        assert!(doc.guides.is_empty());
        assert_eq!(doc.items[0].group_id, None);
    }

    #[test]
    fn guides_roundtrip_and_legacy_default() {
        // guides 字段 camelCase 往返；无 locked 字段的旧数据默认未锁定
        let doc: LayoutDoc = serde_json::from_str(
            r##"{"version":1,"canvas":{"widthMm":297,"heightMm":210,"dpi":300,"background":"#FFFFFF","bleedMm":0},
                "mode":"free","guides":[{"id":"g1","axis":"x","posMm":100.5},{"id":"g2","axis":"y","posMm":20.0,"locked":true}],
                "items":[]}"##,
        )
        .unwrap();
        assert_eq!(doc.guides.len(), 2);
        assert_eq!(doc.guides[0].axis, GuideAxis::X);
        assert!(!doc.guides[0].locked);
        assert!(doc.guides[1].locked);
        let json = serde_json::to_value(&doc).unwrap();
        assert_eq!(json["guides"][0]["posMm"], 100.5);
        assert_eq!(json["guides"][1]["axis"], "y");
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
        // 旧项目文件无图层管理字段：默认可见、不透明、未锁定、无名
        assert!(item.visible);
        assert_eq!(item.opacity, 1.0);
        assert!(!item.locked);
        assert_eq!(item.name, None);
    }

    #[test]
    fn photo_item_layer_fields_roundtrip() {
        let item: PhotoItem = serde_json::from_str(
            r#"{"id":"a","assetId":"b","rect":{"xMm":0,"yMm":0,"wMm":10,"hMm":10},
                "visible":false,"opacity":0.5,"locked":true,"name":"背景 1"}"#,
        )
        .unwrap();
        assert!(!item.visible);
        assert_eq!(item.opacity, 0.5);
        assert!(item.locked);
        assert_eq!(item.name.as_deref(), Some("背景 1"));
    }
}
