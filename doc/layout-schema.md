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
  "masonry": { "columns": 3, "gapMm": 4, "outerMm": 8, "fill": "cover" },
  // grid/masonry 字段仅在对应 mode 下存在；free 模式无布局配置
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
  "crop": null                        // {x,y,w,h} 0–1 归一化裁剪窗口；null=整图
}
```

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
- **masonry**：列宽同 grid 公式；每张照片高度 = 格宽 ÷ 照片宽高比（cover 时裁剪后再等比缩放，格高由内容决定）；逐列填充当前最短列。
- **cover/contain**：cover = 等比放大填满格、超出居中裁剪；contain = 完整显示、格内剩余填背景色。
- **free 吸附**：拖动/缩放时对其他对象边缘与画布中线/边界 ±0.5mm 内吸附；吸附优先于钳制。
- **出血**：导出画布 = (宽+2×bleed) × (高+2×bleed)，背景铺满；照片不进入出血区（除非用户拖到边缘外，则照常合成，出血区仅延展背景与越界内容）。
