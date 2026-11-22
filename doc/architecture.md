# 架构设计

## 1. 技术栈

| 层 | 选型 |
|----|------|
| 桌面壳 / 后端 | Tauri 2 + Rust（crate 在 `src/backend`） |
| 前端 | Vue 3 `<script setup>` + TypeScript + Vite + pnpm（`src/frontend`） |
| UI 组件 | PrimeVue 4 + @primeuix/themes（Aura 预设），原生 CSS 变量，不引入 Tailwind |
| 状态 | Pinia + composables |
| 测试 | Vitest（前端）+ cargo test（Rust，含 fixtures 集成测试） |

## 2. 目录布局

```
doc/         本文档与规格（PRD / 架构 / 布局 schema / 打印尺寸）
src/frontend Vue3+Vite 前端
src/backend  Tauri 2 Rust crate
script/      dev / build / check（零告警门禁）/ test / build-windows.bat + .ps1（Windows 双击一键打包 NSIS，bat 为纯 ASCII 启动器）
test/        fixtures（纯色/渐变样本图、布局样例 JSON）、e2e 断言
tmp/         临时产物（gitignore）
```

## 3. 数据流

```
前端编辑器（逻辑坐标一律毫米）
  ├─ 实时预览：离屏 Canvas，用 ≤2000px 缩略图按同一布局算法渲染
  └─ 导出：LayoutDoc JSON ──invoke──▶ Rust 合成引擎（唯一真源）
Rust 导出管线：
  排版计算 → 解码原图 → EXIF 方向修正 → 翻转/旋转 → 色彩调整
  → 归一化裁剪 → Lanczos 重采样到目标格 → 合成（圆角/描边/出血/背景）
  → JPEG/PNG 编码 + 进度事件
```

**一致性策略**：布局算法 Rust 为唯一真源；前端 TypeScript 镜像实现用于预览，两侧跑同一组 fixtures 用例对拍，保证坐标一致。渲染细节（圆角抗锯齿、任意角旋转的双线性重采样等）预览近似、导出为准。

## 4. 前端模块

- `views/EditorView.vue` — 编辑器主视图（顶栏工具栏 + 画布 + 侧栏面板）
- `components/canvas/CanvasStage.vue` — 画布渲染与交互调度
- `components/canvas/InteractionController.ts` — 交互状态机：选中/拖动/手柄缩放/旋转/平移/缩放手势
- `components/panels/` — 输出规格面板 / 网格参数 / 瀑布流参数 / 单张编辑面板 / 图层面板
- `composables/useCanvasView.ts` — 视口 transform（scale + offset，屏幕⇄毫米换算）
- `composables/useLayoutDoc.ts` — 文档状态 + undo/redo
- `lib/layout/grid.ts`、`masonry.ts` — TS 镜像布局算法
- `stores/` — Pinia：assets（导入照片）、project

## 5. 后端模块（src/backend/src/）

- `commands/` — Tauri command 层：`import_assets`、`export_layout`、`save_project`、`open_in_folder`；导出进度用 emit 事件
- `layout/` — 纯函数排版算法（无 IO）：`grid.rs`、`masonry.rs`、`free.rs`（rect 由前端给定，负责吸附与边界钳制）
- `render/` — `exporter.rs` 管线编排、`ops.rs` 旋转/翻转/色彩、`compose.rs` 合成/圆角/描边/出血
- `presets.rs` — 打印尺寸预设表（唯一出处，毫米值见 doc/spec/print-sizes.md）
- `model.rs` — LayoutDoc / PhotoItem / AssetEntry 数据模型（serde）

## 6. 关键决策

| 决策 | 理由 |
|------|------|
| 逻辑坐标用毫米不用像素 | 打印是物理尺寸业务；DPI 只在导出时换算 px = mm/25.4×dpi |
| 预览用缩略图、导出读原图 | 32 寸 @300DPI 输出约 7200×9600，预览渲染全图不现实 |
| EXIF 方向在 Rust 手动修正 | `image` crate 不自动应用方向，手机竖拍照会横过来 |
| 导出串行逐张合成 | 控制内存峰值（大图 RGBA 缓冲 100MB 级），进度按张数回报 |
| 出血外扩画布 | 冲印裁切误差兜底，背景色延展到出血区 |
