//! 打印尺寸预设查询。

use serde::Serialize;

use crate::presets::{swapped, PRESETS};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetDto {
    pub id: String,
    pub name: String,
    pub width_mm: f64,
    pub height_mm: f64,
    /// 同预设的横版变体（宽高压交换）。
    pub landscape_width_mm: f64,
    pub landscape_height_mm: f64,
}

#[tauri::command]
pub async fn list_presets() -> Result<Vec<PresetDto>, String> {
    Ok(PRESETS
        .iter()
        .map(|p| {
            let land = swapped(p);
            PresetDto {
                id: p.id.to_string(),
                name: p.name.to_string(),
                width_mm: p.width_mm,
                height_mm: p.height_mm,
                landscape_width_mm: land.width_mm,
                landscape_height_mm: land.height_mm,
            }
        })
        .collect())
}
