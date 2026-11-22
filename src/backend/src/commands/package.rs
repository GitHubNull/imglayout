//! .imglayout 单文件项目包：zip = layout.yaml + assets/<assetId>.<ext> 嵌入原图。
//! 保存时把引用的原图复制进包；加载时解压到应用数据目录 packages/<包名>/，
//! 原图仍存在的 asset 继续引用原图，其余改指提取副本；缩略图统一由 ensure_thumbnail 现算，包内不存。

use std::collections::HashMap;
use std::fs;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use zip::write::SimpleFileOptions;

use crate::commands::assets::{ensure_thumbnail, thumb_path, thumbs_dir};
use crate::commands::project::ProjectFile;
use crate::model::{AssetEntry, LayoutDoc};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PackagedAsset {
    pub asset_id: String,
    pub file_name: String,
    pub width_px: u32,
    pub height_px: u32,
    /// 保存时的原图绝对路径；加载时仍存在则继续引用原图
    #[serde(default)]
    pub source_path: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackageManifest {
    version: u32,
    doc: LayoutDoc,
    assets: Vec<PackagedAsset>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveReport {
    pub missing_asset_ids: Vec<String>,
}

/// 包内 assets/ 成员文件名：assetId + 原扩展名（uuid 本身无路径分隔符，安全）
fn file_name_of(entry: &AssetEntry) -> String {
    let ext = Path::new(&entry.path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_else(|| "jpg".to_string());
    format!("{}.{}", entry.asset_id, ext)
}

/// 应用数据目录下的默认提取目录：packages/<包文件名主名>/
fn extract_dir_for(app: &AppHandle, pkg: &Path) -> Result<PathBuf, String> {
    let stem = pkg
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("project")
        .to_string();
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位应用数据目录: {e}"))?
        .join("packages")
        .join(stem);
    Ok(base)
}

/// 目录已存在时追加 _1、_2… 递增后缀，避免覆盖上次打开同名包的提取内容
fn unique_dir(base: PathBuf) -> PathBuf {
    if !base.exists() {
        return base;
    }
    for n in 1..1000 {
        let candidate = base.with_file_name(format!(
            "{}_{n}",
            base.file_name().unwrap().to_string_lossy()
        ));
        if !candidate.exists() {
            return candidate;
        }
    }
    base.with_file_name(format!(
        "{}_{}",
        base.file_name().unwrap().to_string_lossy(),
        uuid::Uuid::new_v4()
    ))
}

/// 保存复用索引：提取目录 assets/ 下已有副本（file stem = assetId）
fn extracted_index(dir: &Path) -> HashMap<String, PathBuf> {
    let mut map = HashMap::new();
    let assets = dir.join("assets");
    if let Ok(rd) = fs::read_dir(&assets) {
        for item in rd.flatten() {
            let p = item.path();
            if p.is_file() {
                if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                    map.insert(stem.to_string(), p);
                }
            }
        }
    }
    map
}

/// zip 成员路径安全校验：拒绝绝对路径、..、反斜杠（Windows 分隔符混淆攻击）
fn validate_member(name: &str) -> Result<(), String> {
    if name.contains('\\') || name.starts_with('/') {
        return Err(format!("项目包包含非法路径: {name}"));
    }
    for comp in Path::new(name).components() {
        if !matches!(comp, Component::Normal(_)) {
            return Err(format!("项目包包含非法路径: {name}"));
        }
    }
    Ok(())
}

/// 纯函数核心：写包。sources 中 bytes 为 None 的 asset 只进清单不进包，返回其 id。
fn build_package(
    out: &Path,
    manifest: &PackageManifest,
    sources: &[(PackagedAsset, Option<Vec<u8>>)],
) -> Result<Vec<String>, String> {
    let yaml = serde_yml::to_string(manifest).map_err(|e| format!("项目序列化失败: {e}"))?;
    let tmp = out.with_file_name(format!(
        "{}.tmp",
        out.file_name().unwrap().to_string_lossy()
    ));
    let result = (|| -> Result<(), String> {
        let file =
            fs::File::create(&tmp).map_err(|e| format!("项目包写入失败 {}: {e}", tmp.display()))?;
        let mut zip = zip::ZipWriter::new(BufWriter::new(file));
        let opt = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        zip.start_file("layout.yaml", opt)
            .map_err(|e| format!("项目包写入失败: {e}"))?;
        zip.write_all(yaml.as_bytes())
            .map_err(|e| format!("项目包写入失败: {e}"))?;
        for (pa, bytes) in sources {
            if let Some(data) = bytes {
                zip.start_file(format!("assets/{}", pa.file_name), opt)
                    .map_err(|e| format!("图片写入项目包失败 {}: {e}", pa.file_name))?;
                zip.write_all(data)
                    .map_err(|e| format!("图片写入项目包失败 {}: {e}", pa.file_name))?;
            }
        }
        zip.finish().map_err(|e| format!("项目包收尾失败: {e}"))?;
        Ok(())
    })();
    if let Err(e) = result {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    // Windows 的 fs::rename 不覆盖已存在目标：先删旧文件
    let _ = fs::remove_file(out);
    fs::rename(&tmp, out).map_err(|e| format!("项目包替换失败 {}: {e}", out.display()))?;
    Ok(sources
        .iter()
        .filter(|(_, b)| b.is_none())
        .map(|(pa, _)| pa.asset_id.clone())
        .collect())
}

/// 纯函数核心：读包并解压原图到 extract_dir。返回清单 + 包内实际解压的文件名。
fn read_package(pkg: &Path, extract_dir: &Path) -> Result<(PackageManifest, Vec<String>), String> {
    let mut magic = [0u8; 2];
    fs::File::open(pkg)
        .and_then(|mut f| f.read_exact(&mut magic))
        .map_err(|e| format!("项目包读取失败 {}: {e}", pkg.display()))?;
    if &magic != b"PK" {
        return Err("不是有效的 .imglayout 项目包（文件损坏或格式不符）".to_string());
    }
    let file = fs::File::open(pkg).map_err(|e| format!("项目包读取失败 {}: {e}", pkg.display()))?;
    let mut zip =
        zip::ZipArchive::new(BufReader::new(file)).map_err(|e| format!("项目包解压失败: {e}"))?;

    let mut yaml_text: Option<String> = None;
    let mut members: Vec<String> = Vec::new();
    for i in 0..zip.len() {
        let mut entry = zip
            .by_index(i)
            .map_err(|e| format!("项目包解压失败: {e}"))?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        validate_member(&name)?;
        if name == "layout.yaml" {
            let mut s = String::new();
            entry
                .read_to_string(&mut s)
                .map_err(|e| format!("layout.yaml 读取失败: {e}"))?;
            yaml_text = Some(s);
        } else if let Some(rest) = name.strip_prefix("assets/") {
            if rest.is_empty() {
                return Err("项目包包含非法路径: assets/".to_string());
            }
            members.push(rest.to_string());
        }
        // 未知成员忽略：向前兼容未来版本新增的条目
    }
    let yaml_text = yaml_text.ok_or_else(|| "项目包缺少 layout.yaml".to_string())?;
    let manifest: PackageManifest =
        serde_yml::from_str(&yaml_text).map_err(|e| format!("layout.yaml 解析失败: {e}"))?;

    let assets_dir = extract_dir.join("assets");
    let mut extracted = Vec::new();
    if !members.is_empty() {
        fs::create_dir_all(&assets_dir)
            .map_err(|e| format!("无法创建提取目录 {}: {e}", assets_dir.display()))?;
        for name in &members {
            let mut entry = zip
                .by_name(&format!("assets/{name}"))
                .map_err(|e| format!("项目包解压失败: {e}"))?;
            let target = assets_dir.join(name);
            let mut out = fs::File::create(&target)
                .map_err(|e| format!("提取写入失败 {}: {e}", target.display()))?;
            std::io::copy(&mut entry, &mut out)
                .map_err(|e| format!("提取写入失败 {}: {e}", target.display()))?;
            extracted.push(name.clone());
        }
    }
    Ok((manifest, extracted))
}

#[tauri::command]
pub async fn save_project_package(
    app: AppHandle,
    path: String,
    doc: LayoutDoc,
    assets: Vec<AssetEntry>,
    allow_missing: bool,
) -> Result<SaveReport, String> {
    let out = Path::new(&path);
    let extract_dir = extract_dir_for(&app, out)?;
    let reuse = extracted_index(&extract_dir);

    // 第一遍定位图像来源：原图 > 上次打开的提取副本 > 缺失
    let mut sources: Vec<(PackagedAsset, Option<Vec<u8>>)> = Vec::with_capacity(assets.len());
    let mut missing: Vec<String> = Vec::new();
    for entry in &assets {
        let pa = PackagedAsset {
            asset_id: entry.asset_id.clone(),
            file_name: file_name_of(entry),
            width_px: entry.width_px,
            height_px: entry.height_px,
            source_path: Some(entry.path.clone()),
        };
        let bytes = if Path::new(&entry.path).is_file() {
            Some(fs::read(&entry.path).map_err(|e| format!("读取原图失败 {}: {e}", entry.path))?)
        } else if let Some(copy) = reuse.get(&entry.asset_id) {
            Some(fs::read(copy).map_err(|e| format!("读取提取副本失败 {}: {e}", copy.display()))?)
        } else {
            missing.push(entry.asset_id.clone());
            None
        };
        sources.push((pa, bytes));
    }
    if !missing.is_empty() && !allow_missing {
        return Err(format!(
            "{} 张照片的原图缺失（id: {}）；可选择跳过缺失继续保存",
            missing.len(),
            missing.join("、")
        ));
    }

    let manifest = PackageManifest {
        version: 1,
        doc,
        assets: sources.iter().map(|(pa, _)| pa.clone()).collect(),
    };
    build_package(out, &manifest, &sources)?;
    Ok(SaveReport {
        missing_asset_ids: missing,
    })
}

#[tauri::command]
pub async fn load_project_package(app: AppHandle, path: String) -> Result<ProjectFile, String> {
    let src = Path::new(&path);
    let extract_dir = unique_dir(extract_dir_for(&app, src)?);
    let (manifest, extracted) = read_package(src, &extract_dir)?;
    let extracted: std::collections::HashSet<String> = extracted.into_iter().collect();

    let thumbs = thumbs_dir(&app)?;
    let mut entries = Vec::with_capacity(manifest.assets.len());
    let mut missing_ids = Vec::new();
    for pa in &manifest.assets {
        let source_path = pa.source_path.clone().unwrap_or_default();
        let source_alive = !source_path.is_empty() && Path::new(&source_path).is_file();
        let packed = extract_dir.join("assets").join(&pa.file_name);
        let (use_path, mut missing) = if source_alive {
            (source_path, false)
        } else if extracted.contains(&pa.file_name) && packed.is_file() {
            (packed.to_string_lossy().to_string(), false)
        } else {
            (packed.to_string_lossy().to_string(), true)
        };
        if !missing {
            let entry = AssetEntry {
                asset_id: pa.asset_id.clone(),
                thumb_path: thumb_path(&thumbs, &pa.asset_id)
                    .to_string_lossy()
                    .to_string(),
                path: use_path.clone(),
                width_px: pa.width_px,
                height_px: pa.height_px,
            };
            // 缩略图补齐失败（提取副本损坏等）按缺失处理，不整体失败
            if ensure_thumbnail(&app, &entry).is_err() {
                missing = true;
            }
        }
        if missing {
            missing_ids.push(pa.asset_id.clone());
        }
        entries.push(AssetEntry {
            asset_id: pa.asset_id.clone(),
            thumb_path: if missing {
                String::new()
            } else {
                thumb_path(&thumbs, &pa.asset_id)
                    .to_string_lossy()
                    .to_string()
            },
            path: use_path,
            width_px: pa.width_px,
            height_px: pa.height_px,
        });
    }

    Ok(ProjectFile {
        version: manifest.version,
        doc: manifest.doc,
        assets: entries,
        missing_asset_ids: missing_ids,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::CanvasSpec;

    fn sample_doc() -> LayoutDoc {
        serde_json::from_str(
            r##"{"version":1,"canvas":{"widthMm":297,"heightMm":210,"dpi":300,"background":"#FFFFFF","bleedMm":0},
                "mode":"free","items":[{"id":"i1","assetId":"a1","rect":{"xMm":1,"yMm":2,"wMm":60,"hMm":60}}]}"##,
        )
        .unwrap()
    }

    fn sample_asset(asset_id: &str, path: &str) -> AssetEntry {
        AssetEntry {
            asset_id: asset_id.to_string(),
            path: path.to_string(),
            thumb_path: String::new(),
            width_px: 800,
            height_px: 600,
        }
    }

    fn pa(asset_id: &str, file_name: &str) -> PackagedAsset {
        PackagedAsset {
            asset_id: asset_id.to_string(),
            file_name: file_name.to_string(),
            width_px: 800,
            height_px: 600,
            source_path: Some(format!("/photos/{asset_id}.jpg")),
        }
    }

    fn jpeg_bytes() -> Vec<u8> {
        let img = image::RgbImage::from_pixel(4, 4, image::Rgb([120, 80, 40]));
        let mut buf = Vec::new();
        image::codecs::jpeg::JpegEncoder::new(&mut buf)
            .encode_image(&image::DynamicImage::ImageRgb8(img))
            .unwrap();
        buf
    }

    #[test]
    fn package_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let pkg = dir.path().join("demo.imglayout");
        let manifest = PackageManifest {
            version: 1,
            doc: sample_doc(),
            assets: vec![pa("a1", "a1.jpg")],
        };
        let data = jpeg_bytes();
        let missing = build_package(
            &pkg,
            &manifest,
            &[(manifest.assets[0].clone(), Some(data.clone()))],
        )
        .unwrap();
        assert!(missing.is_empty());

        let extract = dir.path().join("out");
        let (back, extracted) = read_package(&pkg, &extract).unwrap();
        assert_eq!(back.doc, manifest.doc);
        assert_eq!(back.assets, manifest.assets);
        assert_eq!(extracted, vec!["a1.jpg".to_string()]);
        assert_eq!(
            fs::read(extract.join("assets").join("a1.jpg")).unwrap(),
            data
        );
    }

    #[test]
    fn package_missing_asset_only_in_manifest() {
        let dir = tempfile::tempdir().unwrap();
        let pkg = dir.path().join("demo.imglayout");
        let manifest = PackageManifest {
            version: 1,
            doc: sample_doc(),
            assets: vec![pa("a1", "a1.jpg")],
        };
        let missing =
            build_package(&pkg, &manifest, &[(manifest.assets[0].clone(), None)]).unwrap();
        assert_eq!(missing, vec!["a1".to_string()]);
        // 包可读、清单保留该 asset 登记，便于重新打开定位缺失
        let (back, extracted) = read_package(&pkg, &dir.path().join("out")).unwrap();
        assert_eq!(back.assets.len(), 1);
        assert!(extracted.is_empty());
    }

    #[test]
    fn package_rejects_zip_slip() {
        let dir = tempfile::tempdir().unwrap();
        let pkg = dir.path().join("evil.imglayout");
        let file = fs::File::create(&pkg).unwrap();
        let mut zip = zip::ZipWriter::new(BufWriter::new(file));
        let opt = SimpleFileOptions::default();
        zip.start_file("../evil.png", opt).unwrap();
        zip.finish().unwrap();

        let err = read_package(&pkg, &dir.path().join("out")).unwrap_err();
        assert!(err.contains("非法路径"), "实际错误: {err}");
    }

    #[test]
    fn file_name_keeps_extension() {
        let entry = sample_asset("u1", "/a/b/photo.JPEG");
        assert_eq!(file_name_of(&entry), "u1.jpeg");
        let entry = sample_asset("u1", "noext");
        assert_eq!(file_name_of(&entry), "u1.jpg");
    }

    #[test]
    fn project_file_reports_missing_ids() {
        let json = serde_json::to_value(ProjectFile {
            version: 1,
            doc: LayoutDoc {
                version: 1,
                canvas: CanvasSpec {
                    width_mm: 1.0,
                    height_mm: 1.0,
                    dpi: 300,
                    background: "#fff".to_string(),
                    bleed_mm: 0.0,
                },
                mode: crate::model::LayoutMode::Free,
                grid: None,
                masonry: None,
                groups: vec![],
                guides: vec![],
                items: vec![],
            },
            assets: vec![],
            missing_asset_ids: vec!["a1".to_string()],
        })
        .unwrap();
        assert_eq!(json["missingAssetIds"][0], "a1");
    }
}
