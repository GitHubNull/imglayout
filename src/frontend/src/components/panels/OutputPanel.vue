<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { computed, onMounted, ref } from 'vue'
import { useProjectStore } from '../../stores/project'
import { mmToPx, outputPx, type Preset } from '../../types/layout'

const project = useProjectStore()
const presets = ref<Preset[]>([])
const selectedPresetId = ref<string>('')

onMounted(async () => {
  try {
    presets.value = await invoke<Preset[]>('list_presets')
  } catch {
    // 浏览器直连开发时无 Tauri 运行时，忽略
  }
})

const canvas = computed(() => project.doc.canvas)
const outPx = computed(() => outputPx(canvas.value))

function applyPreset(id: string) {
  const p = presets.value.find((x) => x.id === id)
  if (!p) return
  selectedPresetId.value = id
  project.updateCanvas({ widthMm: p.widthMm, heightMm: p.heightMm })
}

function swapOrientation() {
  selectedPresetId.value = ''
  project.updateCanvas({ widthMm: canvas.value.heightMm, heightMm: canvas.value.widthMm })
}

function customSize() {
  selectedPresetId.value = ''
}
</script>

<template>
  <div class="panel-body">
    <label class="field">
      <span>冲印预设</span>
      <Select
        :model-value="selectedPresetId"
        :options="[{ id: '', name: '自定义' }, ...presets]"
        option-label="name"
        option-value="id"
        placeholder="自定义"
        class="w-full"
        @update:model-value="applyPreset"
      />
    </label>
    <div class="row-2">
      <label class="field">
        <span>宽 (mm)</span>
        <InputNumber
          :model-value="canvas.widthMm"
          :min="25"
          :max="2000"
          :max-fraction-digits="1"
          class="w-full"
          @update:model-value="(v) => { customSize(); project.updateCanvas({ widthMm: v ?? 210 }) }"
        />
      </label>
      <label class="field">
        <span>高 (mm)</span>
        <InputNumber
          :model-value="canvas.heightMm"
          :min="25"
          :max="2000"
          :max-fraction-digits="1"
          class="w-full"
          @update:model-value="(v) => { customSize(); project.updateCanvas({ heightMm: v ?? 297 }) }"
        />
      </label>
    </div>
    <Button label="横竖互换" size="small" class="w-full" @click="swapOrientation" />
    <div class="row-2">
      <label class="field">
        <span>DPI</span>
        <InputNumber
          :model-value="canvas.dpi"
          :min="150"
          :max="600"
          :step="50"
          class="w-full"
          @update:model-value="(v) => project.updateCanvas({ dpi: v ?? 300 })"
        />
      </label>
      <label class="field">
        <span>出血 (mm)</span>
        <InputNumber
          :model-value="canvas.bleedMm"
          :min="0"
          :max="10"
          :step="0.5"
          :max-fraction-digits="1"
          class="w-full"
          @update:model-value="(v) => project.updateCanvas({ bleedMm: v ?? 0 })"
        />
      </label>
    </div>
    <label class="field">
      <span>背景色</span>
      <ColorPicker
        :model-value="canvas.background"
        class="w-full"
        @update:model-value="(v) => project.updateCanvas({ background: v ?? '#FFFFFF' })"
      />
    </label>
    <div class="px-info">
      输出像素：{{ outPx.w }} × {{ outPx.h }} px
      <span v-if="canvas.bleedMm > 0">（含 {{ canvas.bleedMm }}mm 出血，成品 {{ mmToPx(canvas.widthMm, canvas.dpi) }}×{{ mmToPx(canvas.heightMm, canvas.dpi) }} px）</span>
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
.px-info {
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}
.w-full {
  width: 100%;
}
</style>
