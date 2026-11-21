#!/usr/bin/env bash
# 构建前端 + 打包 Tauri 安装包
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pnpm --dir "$ROOT/src/frontend" build
cd "$ROOT/src/backend"
pnpm tauri build
