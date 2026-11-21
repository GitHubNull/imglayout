#!/usr/bin/env bash
# 全部测试：Rust（含 fixtures 集成测试）+ 前端 vitest（含与 Rust 对拍的布局算法测试）
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> cargo test"
cargo test --manifest-path "$ROOT/src/backend/Cargo.toml"

echo "==> vitest"
pnpm --dir "$ROOT/src/frontend" exec vitest run

echo "test: 全部通过"
