//! 排版算法。纯函数、无 IO；Rust 为唯一真源，前端 TS 镜像实现用于预览。
//! 语义详见 doc/layout-schema.md「算法语义」。

pub mod free;
pub mod grid;
pub mod masonry;
