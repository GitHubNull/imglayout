<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../../stores/project'
import { normalizeHexColor } from '../../lib/hexcolor'
import type { PhotoItem } from '../../types/layout'

const project = useProjectStore()

const item = computed<PhotoItem | null>(() => project.selectedItem)

function patch(p: Partial<PhotoItem>, recordHistory = false) {
  if (!item.value) return
  // 快照必须先于变更，否则撤销弹回的是新状态
  if (recordHistory) project.snapshot()
  project.updateItem(item.value.id, p)
}

function patchAdjust(field: 'brightness' | 'contrast' | 'saturation', v: number | undefined) {
  if (!item.value) return
  project.updateItem(item.value.id, {
    adjust: { ...item.value.adjust, [field]: v ?? 1 },
  })
}

function num(v: number | number[] | undefined): number | undefined {
  return typeof v === 'number' ? v : undefined
}

function rotateBy(delta: number) {
  if (!item.value) return
  project.snapshot()
  project.updateItem(item.value.id, {
    rotation: (item.value.rotation + delta + 360) % 360,
  })
}

/** 滑杆手势：首次变更前记一次历史，整个拖动过程合并为一步撤销 */
let gestureActive = false

function beginAdjust() {
  if (!item.value || gestureActive) return
  project.snapshot()
  gestureActive = true
}

function endAdjust() {
  gestureActive = false
}
</script>

<template>
  <div v-if="item" class="panel-body">
    <div class="row-2">
      <Button label="左旋 90°" size="small" class="w-full" @click="rotateBy(-90)" />
      <Button label="右旋 90°" size="small" class="w-full" @click="rotateBy(90)" />
    </div>
    <label class="field">
      <span>旋转：{{ Math.round(item.rotation) }}°</span>
      <Slider
        :model-value="item.rotation"
        :min="0"
        :max="359"
        class="w-full"
        @update:model-value="(v) => { beginAdjust(); patch({ rotation: num(v) ?? 0 }) }"
        @slideend="endAdjust()"
      />
    </label>
    <div class="row-2">
      <Button
        :label="item.flipH ? '已水平翻转' : '水平翻转'"
        size="small"
        :outlined="!item.flipH"
        class="w-full"
        @click="patch({ flipH: !item.flipH }, true)"
      />
      <Button
        :label="item.flipV ? '已垂直翻转' : '垂直翻转'"
        size="small"
        :outlined="!item.flipV"
        class="w-full"
        @click="patch({ flipV: !item.flipV }, true)"
      />
    </div>

    <label class="field">
      <span>亮度：{{ item.adjust.brightness.toFixed(2) }}</span>
      <Slider :model-value="item.adjust.brightness" :min="0" :max="2" :step="0.01" class="w-full" @update:model-value="(v) => { beginAdjust(); patchAdjust('brightness', num(v)) }" @slideend="endAdjust()" />
    </label>
    <label class="field">
      <span>对比度：{{ item.adjust.contrast.toFixed(2) }}</span>
      <Slider :model-value="item.adjust.contrast" :min="0" :max="2" :step="0.01" class="w-full" @update:model-value="(v) => { beginAdjust(); patchAdjust('contrast', num(v)) }" @slideend="endAdjust()" />
    </label>
    <label class="field">
      <span>饱和度：{{ item.adjust.saturation.toFixed(2) }}</span>
      <Slider :model-value="item.adjust.saturation" :min="0" :max="2" :step="0.01" class="w-full" @update:model-value="(v) => { beginAdjust(); patchAdjust('saturation', num(v)) }" @slideend="endAdjust()" />
    </label>

    <label class="field">
      <span>圆角：{{ item.style.radiusMm.toFixed(1) }} mm</span>
      <Slider :model-value="item.style.radiusMm" :min="0" :max="20" :step="0.5" class="w-full" @update:model-value="(v) => { beginAdjust(); patch({ style: { ...item!.style, radiusMm: num(v) ?? 0 } }) }" @slideend="endAdjust()" />
    </label>
    <label class="field">
      <span>边框宽：{{ item.style.borderWidthMm.toFixed(1) }} mm</span>
      <Slider :model-value="item.style.borderWidthMm" :min="0" :max="10" :step="0.5" class="w-full" @update:model-value="(v) => { beginAdjust(); patch({ style: { ...item!.style, borderWidthMm: num(v) ?? 0 } }) }" @slideend="endAdjust()" />
    </label>
    <label v-if="item.style.borderWidthMm > 0" class="field">
      <span>边框颜色</span>
      <ColorPicker :model-value="item.style.borderColor" class="w-full" @update:model-value="(v) => patch({ style: { ...item!.style, borderColor: normalizeHexColor(v, '#000000') } }, true)" />
    </label>
  </div>
  <div v-else class="empty">在画布上点击一张照片进行编辑</div>
</template>

<style scoped>
.panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.empty {
  padding: 24px 12px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  text-align: center;
}
.w-full {
  width: 100%;
}
</style>
