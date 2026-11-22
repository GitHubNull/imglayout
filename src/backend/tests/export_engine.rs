//! 导出引擎端到端集成测试：真实编码 fixtures 图片，导出后重读并断言像素。
//! 与 doc/layout-schema.md 的算法语义逐条对应。

use std::collections::HashMap;

use image::{Rgb, RgbImage};
use imglayout_backend_lib::model::{
    Adjust, AssetEntry, CanvasSpec, CropNorm, FillMode, GridConfig, LayoutDoc, LayoutMode,
    MasonryConfig, PhotoItem, RectMm, Style,
};
use imglayout_backend_lib::presets::find_preset;
use imglayout_backend_lib::render::exporter::{export_layout, ExportFormat, ExportOptions};
use imglayout_backend_lib::units::canvas_px_size;

fn canvas(w: f64, h: f64) -> CanvasSpec {
    CanvasSpec {
        width_mm: w,
        height_mm: h,
        dpi: 300,
        background: "#FFFFFF".to_string(),
        bleed_mm: 0.0,
    }
}

fn item(id: &str, asset_id: &str) -> PhotoItem {
    PhotoItem {
        id: id.to_string(),
        asset_id: asset_id.to_string(),
        rect: RectMm {
            x_mm: 0.0,
            y_mm: 0.0,
            w_mm: 0.0,
            h_mm: 0.0,
        },
        rotation: 0.0,
        flip_h: false,
        flip_v: false,
        adjust: Adjust::default(),
        style: Style::default(),
        crop: None,
        ..PhotoItem::default()
    }
}

fn grid_doc(items: Vec<PhotoItem>, cfg: GridConfig) -> LayoutDoc {
    LayoutDoc {
        version: 1,
        canvas: canvas(100.0, 100.0),
        mode: LayoutMode::Grid,
        grid: Some(cfg),
        masonry: None,
        groups: vec![],
        items,
    }
}

fn write_solid(dir: &tempfile::TempDir, name: &str, color: Rgb<u8>, w: u32, h: u32) -> String {
    let path = dir.path().join(name);
    RgbImage::from_pixel(w, h, color).save(&path).unwrap();
    path.to_string_lossy().to_string()
}

fn register(assets: &mut HashMap<String, AssetEntry>, asset_id: &str, path: &str, w: u32, h: u32) {
    assets.insert(
        asset_id.to_string(),
        AssetEntry {
            asset_id: asset_id.to_string(),
            path: path.to_string(),
            thumb_path: String::new(),
            width_px: w,
            height_px: h,
        },
    );
}

fn export(doc: &LayoutDoc, assets: &HashMap<String, AssetEntry>, out: &std::path::Path) {
    export_layout(
        doc,
        assets,
        out,
        &ExportOptions {
            format: ExportFormat::Png,
            quality: 95,
        },
        &|_, _| {},
    )
    .unwrap();
}

#[test]
fn preset_5in_pixel_size_is_exact() {
    let p = find_preset("5in").unwrap();
    let c = CanvasSpec {
        width_mm: p.width_mm,
        height_mm: p.height_mm,
        dpi: 300,
        background: "#FFFFFF".to_string(),
        bleed_mm: 0.0,
    };
    assert_eq!(canvas_px_size(&c), (1051, 1500));
}

#[test]
fn bleed_expands_output_canvas() {
    let c = CanvasSpec {
        bleed_mm: 3.0,
        ..canvas(100.0, 100.0)
    };
    assert_eq!(canvas_px_size(&c), (1252, 1252));
    // 5 寸 + 3mm 出血 = 95×133mm → 1122×1571
    let p = find_preset("5in").unwrap();
    let c = CanvasSpec {
        width_mm: p.width_mm,
        height_mm: p.height_mm,
        dpi: 300,
        background: "#FFFFFF".to_string(),
        bleed_mm: 3.0,
    };
    assert_eq!(canvas_px_size(&c), (1122, 1571));
}

#[test]
fn grid_four_quadrants_have_expected_colors() {
    let dir = tempfile::tempdir().unwrap();
    let colors = [
        ("red.png", Rgb([255, 0, 0])),
        ("green.png", Rgb([0, 255, 0])),
        ("blue.png", Rgb([0, 0, 255])),
        ("yellow.png", Rgb([255, 255, 0])),
    ];
    let mut assets = HashMap::new();
    let mut items = Vec::new();
    for (i, (name, color)) in colors.iter().enumerate() {
        let path = write_solid(&dir, name, *color, 60, 60);
        let id = format!("asset-{i}");
        register(&mut assets, &id, &path, 60, 60);
        items.push(item(&format!("item-{i}"), &id));
    }

    let doc = grid_doc(
        items,
        GridConfig {
            rows: 2,
            cols: 2,
            gap_mm: 0.0,
            outer_mm: 0.0,
            fill: FillMode::Cover,
        },
    );
    let out = dir.path().join("out.png");
    export(&doc, &assets, &out);

    let img = image::open(&out).unwrap().to_rgb8();
    assert_eq!(img.dimensions(), (1181, 1181));
    // 象限中心：295/885 为 1181 的四分位
    assert_eq!(*img.get_pixel(295, 295), colors[0].1);
    assert_eq!(*img.get_pixel(885, 295), colors[1].1);
    assert_eq!(*img.get_pixel(295, 885), colors[2].1);
    assert_eq!(*img.get_pixel(885, 885), colors[3].1);
}

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
fn cover_crops_to_center_band() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("bands.png");
    banded3().save(&path).unwrap();
    let mut assets = HashMap::new();
    register(&mut assets, "a", &path.to_string_lossy(), 300, 100);

    let doc = grid_doc(
        vec![item("i", "a")],
        GridConfig {
            rows: 1,
            cols: 1,
            gap_mm: 0.0,
            outer_mm: 0.0,
            fill: FillMode::Cover,
        },
    );
    let out = dir.path().join("out.png");
    export(&doc, &assets, &out);

    let img = image::open(&out).unwrap().to_rgb8();
    assert_eq!(*img.get_pixel(590, 590), Rgb([0, 255, 0]));
}

#[test]
fn contain_letterboxes_with_canvas_background() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("bands.png");
    banded3().save(&path).unwrap();
    let mut assets = HashMap::new();
    register(&mut assets, "a", &path.to_string_lossy(), 300, 100);

    let doc = grid_doc(
        vec![item("i", "a")],
        GridConfig {
            rows: 1,
            cols: 1,
            gap_mm: 0.0,
            outer_mm: 0.0,
            fill: FillMode::Contain,
        },
    );
    let out = dir.path().join("out.png");
    export(&doc, &assets, &out);

    let img = image::open(&out).unwrap().to_rgb8();
    assert_eq!(img.dimensions(), (1181, 1181));
    assert_eq!(*img.get_pixel(590, 200), Rgb([255, 255, 255]));
    assert_eq!(*img.get_pixel(590, 590), Rgb([0, 255, 0]));
    assert_eq!(*img.get_pixel(590, 980), Rgb([255, 255, 255]));
}

#[test]
fn rotation_90_turns_bands_horizontal() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("bands.png");
    banded3().save(&path).unwrap();
    let mut assets = HashMap::new();
    register(&mut assets, "a", &path.to_string_lossy(), 300, 100);

    let mut rotated_item = item("i", "a");
    rotated_item.rotation = 90.0;
    // 画布 100×300mm 与旋转后 100×300 的图同宽高比，cover 不裁剪
    let mut doc = grid_doc(
        vec![rotated_item],
        GridConfig {
            rows: 1,
            cols: 1,
            gap_mm: 0.0,
            outer_mm: 0.0,
            fill: FillMode::Cover,
        },
    );
    doc.canvas = canvas(100.0, 300.0);
    let out = dir.path().join("out.png");
    export(&doc, &assets, &out);

    let img = image::open(&out).unwrap().to_rgb8();
    assert_eq!(img.dimensions(), (1181, 3543));
    // 顺时针 90°：竖向 R|G|B 色带变为横向，输出按 1181/100 缩放，带界在 1181/2362
    assert_eq!(*img.get_pixel(590, 500), Rgb([255, 0, 0]));
    assert_eq!(*img.get_pixel(590, 1800), Rgb([0, 255, 0]));
    assert_eq!(*img.get_pixel(590, 3000), Rgb([0, 0, 255]));
}

#[test]
fn brightness_adjust_applies_in_export() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_solid(&dir, "white.png", Rgb([255, 255, 255]), 50, 50);
    let mut assets = HashMap::new();
    register(&mut assets, "a", &path, 50, 50);

    let mut dark = item("i", "a");
    dark.adjust = Adjust {
        brightness: 0.0,
        contrast: 1.0,
        saturation: 1.0,
    };
    let doc = grid_doc(
        vec![dark],
        GridConfig {
            rows: 1,
            cols: 1,
            gap_mm: 0.0,
            outer_mm: 0.0,
            fill: FillMode::Cover,
        },
    );
    let out = dir.path().join("out.png");
    export(&doc, &assets, &out);

    let img = image::open(&out).unwrap().to_rgb8();
    assert_eq!(*img.get_pixel(590, 590), Rgb([0, 0, 0]));
}

#[test]
fn crop_window_limits_source_region() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("bands.png");
    banded3().save(&path).unwrap();
    let mut assets = HashMap::new();
    register(&mut assets, "a", &path.to_string_lossy(), 300, 100);

    // 只取右三分之一（蓝色带）
    let mut cropped = item("i", "a");
    cropped.crop = Some(CropNorm {
        x: 2.0 / 3.0,
        y: 0.0,
        w: 1.0 / 3.0,
        h: 1.0,
    });
    let doc = grid_doc(
        vec![cropped],
        GridConfig {
            rows: 1,
            cols: 1,
            gap_mm: 0.0,
            outer_mm: 0.0,
            fill: FillMode::Cover,
        },
    );
    let out = dir.path().join("out.png");
    export(&doc, &assets, &out);

    let img = image::open(&out).unwrap().to_rgb8();
    assert_eq!(*img.get_pixel(590, 590), Rgb([0, 0, 255]));
}

#[test]
fn background_fills_bleed_area() {
    let dir = tempfile::tempdir().unwrap();
    let mut doc = grid_doc(
        vec![],
        GridConfig {
            rows: 1,
            cols: 1,
            gap_mm: 0.0,
            outer_mm: 0.0,
            fill: FillMode::Cover,
        },
    );
    doc.canvas.background = "#FF0000".to_string();
    doc.canvas.bleed_mm = 3.0;

    let assets = HashMap::new();
    let out = dir.path().join("out.png");
    export(&doc, &assets, &out);

    let img = image::open(&out).unwrap().to_rgb8();
    // 100mm + 3mm 双边出血 = 106mm → 1252px
    assert_eq!(img.dimensions(), (1252, 1252));
    assert_eq!(*img.get_pixel(0, 0), Rgb([255, 0, 0]));
    assert_eq!(*img.get_pixel(1251, 1251), Rgb([255, 0, 0]));
}

#[test]
fn masonry_export_places_photos_by_column() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_solid(&dir, "sq.png", Rgb([10, 200, 30]), 100, 100);
    let mut assets = HashMap::new();
    register(&mut assets, "a", &path, 100, 100);

    let doc = LayoutDoc {
        version: 1,
        canvas: canvas(100.0, 200.0),
        mode: LayoutMode::Masonry,
        grid: None,
        masonry: Some(MasonryConfig {
            columns: 2,
            gap_mm: 0.0,
            outer_mm: 0.0,
        }),
        groups: vec![],
        items: vec![item("i1", "a"), item("i2", "a")],
    };
    let out = dir.path().join("out.png");
    export(&doc, &assets, &out);

    let img = image::open(&out).unwrap().to_rgb8();
    // 100×200 画布 @300dpi = 1181×2362；两张 1:1 各占左/右列宽 50mm=591px，框高同宽
    assert_eq!(img.dimensions(), (1181, 2362));
    assert_eq!(*img.get_pixel(295, 295), Rgb([10, 200, 30]));
    assert_eq!(*img.get_pixel(885, 295), Rgb([10, 200, 30]));
    // 第二列照片从 y=0 开始（最短列规则），其下方为背景
    assert_eq!(*img.get_pixel(885, 1000), Rgb([255, 255, 255]));
}

#[test]
fn free_mode_uses_item_rect_directly() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_solid(&dir, "sq.png", Rgb([0, 0, 0]), 100, 100);
    let mut assets = HashMap::new();
    register(&mut assets, "a", &path, 100, 100);

    let mut placed = item("i", "a");
    placed.rect = RectMm {
        x_mm: 10.0,
        y_mm: 10.0,
        w_mm: 20.0,
        h_mm: 20.0,
    };
    let doc = LayoutDoc {
        version: 1,
        canvas: canvas(100.0, 100.0),
        mode: LayoutMode::Free,
        grid: None,
        masonry: None,
        groups: vec![],
        items: vec![placed],
    };
    let out = dir.path().join("out.png");
    export(&doc, &assets, &out);

    let img = image::open(&out).unwrap().to_rgb8();
    // 10mm=118px 起，20mm=236px 宽
    assert_eq!(*img.get_pixel(200, 200), Rgb([0, 0, 0]));
    assert_eq!(*img.get_pixel(50, 50), Rgb([255, 255, 255]));
}

#[test]
fn hidden_item_is_skipped_in_export() {
    let dir = tempfile::tempdir().unwrap();
    let red = write_solid(&dir, "red.png", Rgb([255, 0, 0]), 60, 60);
    let green = write_solid(&dir, "green.png", Rgb([0, 200, 0]), 60, 60);
    let mut assets = HashMap::new();
    register(&mut assets, "a-red", &red, 60, 60);
    register(&mut assets, "a-green", &green, 60, 60);

    let mut hidden = item("i-hidden", "a-green");
    hidden.visible = false;
    let doc = grid_doc(
        vec![item("i-red", "a-red"), hidden],
        GridConfig {
            rows: 1,
            cols: 2,
            gap_mm: 0.0,
            outer_mm: 0.0,
            fill: FillMode::Cover,
        },
    );
    let out = dir.path().join("out.png");
    export(&doc, &assets, &out);

    let img = image::open(&out).unwrap().to_rgb8();
    // 左格红；隐藏层所在右格保持背景白
    assert_eq!(*img.get_pixel(295, 295), Rgb([255, 0, 0]));
    assert_eq!(*img.get_pixel(885, 295), Rgb([255, 255, 255]));
}

#[test]
fn opacity_blends_layer_with_background() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_solid(&dir, "red.png", Rgb([255, 0, 0]), 60, 60);
    let mut assets = HashMap::new();
    register(&mut assets, "a", &path, 60, 60);

    let mut half = item("i", "a");
    half.opacity = 0.5;
    let doc = grid_doc(
        vec![half],
        GridConfig {
            rows: 1,
            cols: 1,
            gap_mm: 0.0,
            outer_mm: 0.0,
            fill: FillMode::Cover,
        },
    );
    let out = dir.path().join("out.png");
    export(&doc, &assets, &out);

    let img = image::open(&out).unwrap().to_rgb8();
    // 0.5×红 + 0.5×白 = (255, 127~128, 127~128)
    let px = img.get_pixel(590, 590);
    assert_eq!(px[0], 255);
    assert!((127..=128).contains(&px[1]));
    assert!((127..=128).contains(&px[2]));
}
