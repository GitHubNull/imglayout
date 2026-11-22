pub mod commands;
pub mod layout;
pub mod model;
pub mod presets;
pub mod render;
pub mod units;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::assets::import_assets,
            commands::export::export_layout_cmd,
            commands::presets::list_presets,
            commands::project::save_project,
            commands::project::load_project,
            commands::package::save_project_package,
            commands::package::load_project_package,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
