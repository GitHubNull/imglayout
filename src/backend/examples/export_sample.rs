//! 生成导出样例到仓库 tmp/ 目录，供人工查看验收。
//! 运行：cargo run --example export_sample

use std::collections::HashMap;

use image::{Rgb, RgbImage};
use imglayout_backend_lib::model::{
    Adjust, AssetEntry, CanvasSpec, FillMode, GridConfig, LayoutDoc, LayoutMode, PhotoItem, RectMm,
    Style,
};
use imglayout_backend_lib::presets::find_preset;
use imglayout_backend_lib::render::exporter::{export_layout, ExportFormat, ExportOptions};

fn main() {
    let out_dir = std::path::Path::new("../../tmp/sample-assets");
    std::fs::create_dir_all(out_dir).unwrap();

    let palette = [
        Rgb([214, 69, 65]),
        Rgb([246, 185, 59]),
        Rgb([30, 130, 76]),
        Rgb([65, 131, 215]),
        Rgb([155, 89, 182]),
        Rgb([241, 130, 141]),
    ];

    let mut assets = HashMap::new();
    let mut items = Vec::new();
    for (i, color) in palette.iter().enumerate() {
        // 交替横竖构图，验证 cover 裁剪
        let (w, h) = if i % 2 == 0 { (800, 600) } else { (600, 800) };
        let mut img = RgbImage::from_pixel(w, h, *color);
        // 叠加对角白色条带，让裁剪效果肉眼可见
        for d in 0..w.min(h) {
            img.put_pixel(d, d, Rgb([255, 255, 255]));
        }
        let path = out_dir.join(format!("tile-{i}.png"));
        img.save(&path).unwrap();

        let asset_id = format!("asset-{i}");
        assets.insert(
            asset_id.clone(),
            AssetEntry {
                asset_id: asset_id.clone(),
                path: path.to_string_lossy().to_string(),
                thumb_path: String::new(),
                width_px: w,
                height_px: h,
            },
        );
        items.push(PhotoItem {
            id: format!("item-{i}"),
            asset_id,
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
        });
    }

    let preset = find_preset("10in").unwrap();
    let doc = LayoutDoc {
        version: 1,
        canvas: CanvasSpec {
            width_mm: preset.width_mm,
            height_mm: preset.height_mm,
            dpi: 300,
            background: "#F5F5F0".to_string(),
            bleed_mm: 0.0,
        },
        mode: LayoutMode::Grid,
        grid: Some(GridConfig {
            rows: 3,
            cols: 2,
            gap_mm: 6.0,
            outer_mm: 12.0,
            fill: FillMode::Cover,
        }),
        masonry: None,
        groups: vec![],
        items,
    };

    let out = std::path::Path::new("../../tmp/sample-grid-10in.png");
    export_layout(
        &doc,
        &assets,
        out,
        &ExportOptions {
            format: ExportFormat::Png,
            quality: 95,
        },
        &|done, total| println!("progress {done}/{total}"),
    )
    .unwrap();
    println!("导出完成: {}", out.canonicalize().unwrap().display());
}
