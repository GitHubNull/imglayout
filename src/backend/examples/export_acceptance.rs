//! M4 验收：5 寸与 32 寸真实导出（JPEG），打印耗时。
//! 运行：cargo run --release --example export_acceptance

use std::collections::HashMap;
use std::time::Instant;

use image::{Rgb, RgbImage};
use imglayout_backend_lib::model::{
    Adjust, AssetEntry, CanvasSpec, FillMode, GridConfig, LayoutDoc, LayoutMode, PhotoItem, RectMm,
    Style,
};
use imglayout_backend_lib::presets::find_preset;
use imglayout_backend_lib::render::exporter::{export_layout, ExportFormat, ExportOptions};
use imglayout_backend_lib::units::canvas_px_size;

const TILE_COUNT: usize = 6;

fn ensure_tiles(out_dir: &std::path::Path) -> Vec<String> {
    std::fs::create_dir_all(out_dir).unwrap();
    let palette = [
        Rgb([214, 69, 65]),
        Rgb([246, 185, 59]),
        Rgb([30, 130, 76]),
        Rgb([65, 131, 215]),
        Rgb([155, 89, 182]),
        Rgb([241, 130, 141]),
    ];
    let mut paths = Vec::new();
    for (i, color) in palette.iter().enumerate().take(TILE_COUNT) {
        let path = out_dir.join(format!("tile-{i}.png"));
        if !path.exists() {
            let (w, h) = if i % 2 == 0 {
                (2400, 1800)
            } else {
                (1800, 2400)
            };
            let mut img = RgbImage::from_pixel(w, h, *color);
            for d in 0..w.min(h) {
                img.put_pixel(d, d, Rgb([255, 255, 255]));
            }
            img.save(&path).unwrap();
        }
        paths.push(path.to_string_lossy().to_string());
    }
    paths
}

fn build_doc(preset_id: &str, tile_paths: &[String]) -> (LayoutDoc, HashMap<String, AssetEntry>) {
    let preset = find_preset(preset_id).unwrap();
    let mut assets = HashMap::new();
    let mut items = Vec::new();
    for (i, path) in tile_paths.iter().enumerate() {
        let (w, h) = if i % 2 == 0 {
            (2400, 1800)
        } else {
            (1800, 2400)
        };
        let asset_id = format!("asset-{preset_id}-{i}");
        assets.insert(
            asset_id.clone(),
            AssetEntry {
                asset_id: asset_id.clone(),
                path: path.clone(),
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
        });
    }
    (
        LayoutDoc {
            version: 1,
            canvas: CanvasSpec {
                width_mm: preset.width_mm,
                height_mm: preset.height_mm,
                dpi: 300,
                background: "#FFFFFF".to_string(),
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
            items,
        },
        assets,
    )
}

fn main() {
    let tile_paths = ensure_tiles(std::path::Path::new("../../tmp/sample-assets"));
    let opts = ExportOptions {
        format: ExportFormat::Jpeg,
        quality: 95,
    };

    for preset_id in ["5in", "32in"] {
        let (doc, assets) = build_doc(preset_id, &tile_paths);
        let out_name = format!("../../tmp/acceptance-{preset_id}.jpg");
        let out = std::path::Path::new(&out_name);
        let start = Instant::now();
        export_layout(&doc, &assets, out, &opts, &|done, total| {
            if done == total {
                println!("[{preset_id}] 合成 {done}/{total}");
            }
        })
        .unwrap();
        let px = canvas_px_size(&doc.canvas);
        println!(
            "[{preset_id}] {}×{}mm → {}×{}px，耗时 {:?}，输出 {}",
            doc.canvas.width_mm,
            doc.canvas.height_mm,
            px.0,
            px.1,
            start.elapsed(),
            out.canonicalize().unwrap().display()
        );
    }
}
