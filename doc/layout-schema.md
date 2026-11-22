# LayoutDoc 数据模型（前后端共用 schema）

坐标约定：除 `crop` 与原图像素外，**所有几何量一律为毫米**。DPI 只在导出时把毫米换算成像素：`px = round(mm / 25.4 × dpi)`。

## LayoutDoc

```jsonc
{
  "version": 1,
  "canvas": {
    "widthMm": 254,        // 成品宽（不含出血）
    "heightMm": 381,       // 成品高（不含出血）
    "dpi": 300,            // 150–600
    "background": "#FFFFFF",
    "bleedMm": 0           // 出血外扩，画面延展到 bleed 区
  },
  "mode": "grid",          // grid | masonry | free
  "grid":    { "rows": 2, "cols": 3, "gapMm": 4, "outerMm": 8, "fill": "cover" },
  "masonry": { "columns": 3, "gapMm": 4, "outerMm": 8 },
  // grid/masonry 字段仅在对应 mode 下存在；free 模式无布局配置
  // masonry 无 fill：框高由照片（裁剪后）宽高比决定，照片等比填满自己的框
  "groups": [ { "id": "group-uuid", "name": null } ],  // 自由布局组合；旧文档可无此字段（默认 []）
  "guides": [ { "id": "guide-uuid", "axis": "x", "posMm": 100.5, "locked": false } ],
  // 参考线：axis 'x'=竖直线（定 x 坐标）/'y'=水平线（定 y 坐标）；posMm 为距成品左缘/顶缘毫米值
  // 仅编辑器辅助显示，不导出；旧文档可无此字段（默认 []），locked 缺省 false
  "items": [ /* PhotoItem[]，数组顺序 = free 模式层级（底→顶） */ ]
}
```

## PhotoItem

```jsonc
{
  "id": "item-uuid",
  "assetId": "asset-uuid",            // 指向 AssetEntry
  "rect": { "xMm": 8, "yMm": 8, "wMm": 120, "hMm": 80 },
  // grid/masonry：rect 由算法计算，随配置变化重算
  // free：rect 由用户拖拽产生
  "rotation": 0,                      // 度，顺时针
  "flipH": false,
  "flipV": false,
  "adjust": { "brightness": 1, "contrast": 1, "saturation": 1 },  // 0–2
  "style": { "radiusMm": 0, "borderWidthMm": 0, "borderColor": "#000000" },
  "crop": null,                       // {x,y,w,h} 0–1 归一化裁剪窗口；null=整图
  // —— 图层管理字段（均带默认值，旧项目文件缺省时自动补齐）——
  "visible": true,                    // 隐藏层：预览不绘制、导出跳过、画布不可点选
  "opacity": 1,                       // 0–1，整层（含边框）与背景混合的比例
  "locked": false,                    // 锁定层：画布上禁止移动/缩放/旋转/微调/删除
  "name": null,                       // 图层自定义名；null 回退为文件名
  "groupId": null                     // 所属组合 id；删除任一会连带删除全组
}
```

图层字段语义（预览与导出口径一致）：

- **visible**：隐藏层仍参与 grid/masonry 排版占位（与 PS 一致），只是不绘制、不导出。
- **opacity**：导出时把该层合成结果的 alpha 通道按比例缩放后再 blend 到画布；预览用 canvas `globalAlpha` 近似。
- **locked**：只约束画布交互（InteractionController），图层面板仍可重命名/删除/复制/调不透明度。
- **groups / groupId**：组合仅影响画布交互（组内成员联动移动、连带删除）；渲染与导出忽略组。旧项目文件无这两个字段时按空组合处理。
- **guides**：参考线仅自由排版模式在画布上显示与交互（拖出/拖动/拖回删除），拖动照片时作为吸附目标；渲染与导出忽略参考线。旧项目文件无该字段时按空数组处理。

## AssetEntry（导入照片登记表，不入 LayoutDoc）

```jsonc
{
  "assetId": "asset-uuid",
  "path": "/abs/path/original.jpg",   // 原图路径，导出时读取
  "thumbPath": "/abs/path/thumb.jpg", // ≤2000px 缩略图，预览用
  "widthPx": 4032,
  "heightPx": 3024
}
```

## 算法语义

- **grid**：内容区 = 画布减 2×outerMm；格宽 = (内容宽 − (cols−1)×gap)/cols，余数像素/亚毫米分配到末列（保证守恒 Σw + Σgap = 内容宽）。行高同理。照片按序从左到右、从上到下填充，多余照片丢弃位、不足留空格。
- **masonry**：列宽同 grid 公式；每张照片高度 = 列宽 ÷ 照片（crop 窗口折算后）宽高比，框高由内容决定；逐张放入当前最短列。照片恒等比填满自己的框，无 cover/contain 之分（与 grid 不同）。
- **cover/contain**：cover = 等比放大填满格、超出居中裁剪；contain = 完整显示、格内剩余填背景色。
- **free 吸附**：拖动/缩放时对其他对象边缘与画布中线/边界 ±0.5mm 内吸附；吸附优先于钳制。
- **出血**：导出画布 = (宽+2×bleed) × (高+2×bleed)，背景铺满；照片不进入出血区（除非用户拖到边缘外，则照常合成，出血区仅延展背景与越界内容）。
