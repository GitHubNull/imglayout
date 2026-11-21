//! 项目保存/加载：LayoutDoc + 资源登记表序列化为单个 JSON 文件。

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::commands::assets::ensure_thumbnail;
use crate::model::{AssetEntry, LayoutDoc};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFile {
    pub version: u32,
    pub doc: LayoutDoc,
    pub assets: Vec<AssetEntry>,
}

#[tauri::command]
pub async fn save_project(
    path: String,
    doc: LayoutDoc,
    assets: Vec<AssetEntry>,
) -> Result<(), String> {
    let file = ProjectFile {
        version: 1,
        doc,
        assets,
    };
    let json = serde_json::to_string_pretty(&file).map_err(|e| format!("项目序列化失败: {e}"))?;
    fs::write(Path::new(&path), json).map_err(|e| format!("项目写入失败 {path}: {e}"))
}

#[tauri::command]
pub async fn load_project(app: AppHandle, path: String) -> Result<ProjectFile, String> {
    let json =
        fs::read_to_string(Path::new(&path)).map_err(|e| format!("项目读取失败 {path}: {e}"))?;
    let file: ProjectFile =
        serde_json::from_str(&json).map_err(|e| format!("项目解析失败: {e}"))?;
    for asset in &file.assets {
        ensure_thumbnail(&app, asset).map_err(|e| format!("缩略图补齐失败 {}: {e}", asset.path))?;
    }
    Ok(file)
}
