//! 导出管线：解码 → EXIF 方向 → 翻转/旋转 → 色彩调整 → 裁剪 → 重采样 → 合成 → 编码。

pub mod compose;
pub mod exporter;
pub mod ops;
