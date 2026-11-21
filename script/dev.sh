#!/usr/bin/env bash
# 开发模式：前端 vite + Tauri 窗口
set -e
cd "$(dirname "$0")/../src/backend"
pnpm tauri dev
