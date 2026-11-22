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
    /// 仅项目包加载时可能出现：包内缺图像数据的 asset id（save/旧 JSON 加载恒为空）
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub missing_asset_ids: Vec<String>,
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
        missing_asset_ids: Vec::new(),
    };
    let json = serde_json::to_string_pretty(&file).map_err(|e| format!("项目序列化失败: {e}"))?;
    fs::write(Path::new(&path), json).map_err(|e| format!("项目写入失败 {path}: {e}"))
}

#[tauri::command]
pub async fn load_project(app: AppHandle, path: String) -> Result<ProjectFile, String> {
    let json =
        fs::read_to_string(Path::new(&path)).map_err(|e| format!("项目读取失败 {path}: {e}"))?;
    let mut file: ProjectFile =
        serde_json::from_str(&json).map_err(|e| format!("项目解析失败: {e}"))?;
    // 单张原图缺失/损坏不阻塞整个项目：标记缺失继续（与 .imglayout 口径一致）
    let mut missing = Vec::new();
    for asset in &mut file.assets {
        if ensure_thumbnail(&app, asset).is_err() {
            missing.push(asset.asset_id.clone());
            asset.thumb_path = String::new();
        }
    }
    file.missing_asset_ids = missing;
    Ok(file)
}
