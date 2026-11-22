# AGENTS.md —— AI 编程代理工作指引

本文件面向在本仓库工作的 AI 编程代理。内容浓缩自 [doc/ai-agent/](doc/ai-agent/) 教程；人类开发者请读 [doc/developer/](doc/developer/)。

## 项目一句话

imgLayout：Tauri 2（Rust 后端，`src/backend/`）+ Vue 3（前端，`src/frontend/`）的桌面照片排版打印工具。UI 以 Photoshop 为参照，全中文界面。

## 目录地图

```
src/frontend/   Vue 3 + PrimeVue 4 + Pinia（全局注册组件，无 i18n，中文硬编码）
  src/views/EditorView.vue    顶栏/面板/弹窗编排，所有新入口改这里
  src/components/             panels/ canvas/ statusbar/ toolbar/ settings/ help/
  src/stores/                 Pinia：project(文档+撤销栈) assets settings shortcuts
  src/lib/                    纯函数：layout 算法、画布主题、快捷键、教程数据
src/backend/    Tauri v2 Rust：commands/（保存/导出/项目包）、render/、layout/
doc/            用户/开发者/AI 代理三级教程 + 架构与格式文档
script/         dev.sh build.sh check.sh test.sh + build-windows.bat（Windows 双击打包，根 package.json 只做转发）
```

## 命令

| 命令 | 作用 |
| ---- | ---- |
| `pnpm dev` | Tauri dev（Vite 1420 端口） |
| `pnpm check` | 零告警门禁，四步全绿才算过：cargo clippy `-D warnings` → `cargo fmt --check` → `vue-tsc -b --noEmit` → `vite build` |
| `pnpm test` | `cargo test` + `pnpm --dir src/frontend exec vitest run` |

提交前必须跑 `pnpm check && pnpm test`。

## 硬性约定（违反即返工）

1. **单文件 ≤500 行**，无豁免；改前 `wc -l` 自查，逼近上限先拆分。
2. **`PhotoItem`/`LayoutDoc` 与 Rust serde camelCase 严格耦合**：禁止加字段；一切派生量（如图层序号）从 `items` 数组位置计算，不写入文档。
3. **PS 图层语义**：`items` 数组末尾 = 最顶层；显示序号 = 数组下标 + 1（顶部最大）。
4. **先快照后变更**：改 `doc` 前先 `project.snapshot()`（store 内 `reorder`/`moveItem` 等已内置）。
5. **测试与被测文件同目录**：`<名>.spec.ts`；Rust 测试内联 `#[cfg(test)]` + `src/backend/tests/` 集成测试；改控制器类后相关 spec 要同步。
6. **中文硬编码、无 i18n**：新增 UI 文案直接写中文。
7. **CHANGELOG 用中文 Keep a Changelog 格式**，变更记入 `[Unreleased]`，由维护者在发版时收口。
8. **软件内教程数据同步**：`src/frontend/src/lib/help/tutorials.ts` 与 `doc/user/*.md` 内容一一对应，改一处必须改另一处。
9. primeicons 8 已删 `pi-redo` 等字形，用 `pi-refresh` 代替；新增图标先确认字形存在。
10. 发版时 tag 版本必须与根 `package.json`、`src/backend/tauri.conf.json`、`src/backend/Cargo.toml` 三处一致（CI 校验）；前端显示的版本经 `virtual:app-info` 从根 package.json 构建期注入，无需手工同步。

## 提交流程

改代码 → `pnpm check` → `pnpm test` → 更新 CHANGELOG `[Unreleased]` → 提交。不要顺手重构无关代码，不要放宽门禁。
