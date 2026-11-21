//! 导出命令：异步执行合成，进度通过 export-progress 事件推给前端。

use std::collections::HashMap;
use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::model::{AssetEntry, LayoutDoc};
use crate::render::exporter::{export_layout, ExportFormat, ExportOptions};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportProgress {
    done: usize,
    total: usize,
}

#[tauri::command]
pub async fn export_layout_cmd(
    app: AppHandle,
    doc: LayoutDoc,
    assets: Vec<AssetEntry>,
    out_path: String,
    format: String,
    quality: u8,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let asset_map: HashMap<String, AssetEntry> = assets
            .into_iter()
            .map(|a| (a.asset_id.clone(), a))
            .collect();
        let format = match format.as_str() {
            "png" => ExportFormat::Png,
            _ => ExportFormat::Jpeg,
        };
        let opts = ExportOptions { format, quality };
        let app = app.clone();
        export_layout(
            &doc,
            &asset_map,
            Path::new(&out_path),
            &opts,
            &move |done, total| {
                let _ = app.emit("export-progress", ExportProgress { done, total });
            },
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("导出任务失败: {e}"))?
}
