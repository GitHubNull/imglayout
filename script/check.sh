#!/usr/bin/env bash
# 零告警门禁：clippy + cargo fmt 检查 + vue-tsc + vite build
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> cargo clippy (deny warnings)"
cargo clippy --manifest-path "$ROOT/src/backend/Cargo.toml" --all-targets -- -D warnings

echo "==> cargo fmt 检查"
cargo fmt --manifest-path "$ROOT/src/backend/Cargo.toml" -- --check

echo "==> vue-tsc 类型检查"
pnpm --dir "$ROOT/src/frontend" exec vue-tsc -b --noEmit

echo "==> vite 构建"
pnpm --dir "$ROOT/src/frontend" build

echo "check: 全部通过"
