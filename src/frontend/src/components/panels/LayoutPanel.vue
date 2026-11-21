<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../../stores/project'
import type { LayoutMode } from '../../types/layout'

const project = useProjectStore()

const modeOptions = [
  { label: '规则网格', value: 'grid' },
  { label: '瀑布流', value: 'masonry' },
  { label: '自由排版', value: 'free' },
]

const fillOptions = [
  { label: '裁剪填满', value: 'cover' },
  { label: '完整显示', value: 'contain' },
]

const mode = computed({
  get: () => project.doc.mode,
  set: (v: LayoutMode) => project.setMode(v),
})

const grid = computed(() => project.doc.grid)
const masonry = computed(() => project.doc.masonry)
</script>

<template>
  <div class="panel-body">
    <label class="field">
      <span>布局模式</span>
      <SelectButton v-model="mode" :options="modeOptions" option-label="label" option-value="value" class="w-full" />
    </label>

    <template v-if="mode === 'grid' && grid">
      <div class="row-2">
        <label class="field">
          <span>行数</span>
          <InputNumber :model-value="grid.rows" :min="1" :max="20" class="w-full" @update:model-value="(v) => project.updateGrid({ rows: v ?? 1 })" />
        </label>
        <label class="field">
          <span>列数</span>
          <InputNumber :model-value="grid.cols" :min="1" :max="20" class="w-full" @update:model-value="(v) => project.updateGrid({ cols: v ?? 1 })" />
        </label>
      </div>
      <div class="row-2">
        <label class="field">
          <span>内间距 (mm)</span>
          <InputNumber :model-value="grid.gapMm" :min="0" :max="50" :step="0.5" :max-fraction-digits="1" class="w-full" @update:model-value="(v) => project.updateGrid({ gapMm: v ?? 0 })" />
        </label>
        <label class="field">
          <span>外边距 (mm)</span>
          <InputNumber :model-value="grid.outerMm" :min="0" :max="100" :step="0.5" :max-fraction-digits="1" class="w-full" @update:model-value="(v) => project.updateGrid({ outerMm: v ?? 0 })" />
        </label>
      </div>
      <label class="field">
        <span>填充方式</span>
        <SelectButton :model-value="grid.fill" :options="fillOptions" option-label="label" option-value="value" class="w-full" @update:model-value="(v) => project.updateGrid({ fill: v ?? 'cover' })" />
      </label>
    </template>

    <template v-if="mode === 'masonry' && masonry">
      <div class="row-2">
        <label class="field">
          <span>列数</span>
          <InputNumber :model-value="masonry.columns" :min="1" :max="10" class="w-full" @update:model-value="(v) => project.updateMasonry({ columns: v ?? 1 })" />
        </label>
        <label class="field">
          <span>内间距 (mm)</span>
          <InputNumber :model-value="masonry.gapMm" :min="0" :max="50" :step="0.5" :max-fraction-digits="1" class="w-full" @update:model-value="(v) => project.updateMasonry({ gapMm: v ?? 0 })" />
        </label>
      </div>
      <label class="field">
        <span>外边距 (mm)</span>
        <InputNumber :model-value="masonry.outerMm" :min="0" :max="100" :step="0.5" :max-fraction-digits="1" class="w-full" @update:model-value="(v) => project.updateMasonry({ outerMm: v ?? 0 })" />
      </label>
    </template>

    <div v-if="mode === 'free'" class="hint">
      自由排版：拖动移动，四角/边手柄缩放，顶部圆点旋转；Shift+方向键微调 1mm；Delete 删除。
    </div>
    <div v-if="mode === 'grid'" class="hint">
      网格按导入顺序从左到右、从上到下填充，超出容量的照片不出现在版面中。
    </div>
  </div>
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
.hint {
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
}
.w-full {
  width: 100%;
}
</style>
