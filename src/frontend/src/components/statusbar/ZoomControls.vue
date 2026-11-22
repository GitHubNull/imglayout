<script setup lang="ts">
import { ref } from 'vue'
import type { useCanvasView } from '../../composables/useCanvasView'
import type CanvasStage from '../canvas/CanvasStage.vue'

const props = defineProps<{
  view: ReturnType<typeof useCanvasView>
  stage: InstanceType<typeof CanvasStage> | null
}>()

/** 读数编辑态：单击读数弹出百分比输入框 */
const editing = ref(false)
const draft = ref<number | null>(null)

function openEditor() {
  draft.value = props.view.zoomPercent.value
  editing.value = true
}

function commit() {
  if (!editing.value) return
  editing.value = false
  const pct = draft.value
  if (pct == null) return
  props.stage?.zoomToPercent(Math.min(800, Math.max(10, pct)))
}

function cancel() {
  editing.value = false
}

/** 双击读数：直接恢复 100%（须先于 blur-commit 置 editing=false 防抖） */
function onReadoutDblClick() {
  editing.value = false
  props.stage?.zoomToPercent(100)
}
</script>

<template>
  <div class="zoom-controls">
    <Button icon="pi pi-minus" text title="缩小" @click="stage?.zoomStep(1 / 1.25)" />
    <div class="readout-wrap" @dblclick="onReadoutDblClick">
      <Button
        :label="`${view.zoomPercent.value}%`"
        text
        class="zoom-readout"
        title="单击输入缩放百分比；双击恢复 100%"
        @click="openEditor"
      />
      <div v-if="editing" class="zoom-editor">
        <InputNumber
          v-model="draft"
          :min="10"
          :max="800"
          :step="10"
          size="small"
          class="zoom-input"
          autofocus
          @keyup.enter="commit"
          @keyup.esc="cancel"
          @blur="commit"
        />
      </div>
    </div>
    <Button
      label="适应"
      text
      :severity="view.isAutoFit.value ? 'primary' : 'secondary'"
      :title="view.isAutoFit.value ? '自动适配中：窗口变化时将自动调整缩放' : '适应窗口（恢复自动适配）'"
      @click="stage?.fitView()"
    />
    <Button icon="pi pi-plus" text title="放大" @click="stage?.zoomStep(1.25)" />
  </div>
</template>

<style scoped>
.zoom-controls {
  display: flex;
  align-items: center;
  gap: 2px;
}
.readout-wrap {
  position: relative;
}
.zoom-readout {
  min-width: 56px;
  font-variant-numeric: tabular-nums;
}
.zoom-editor {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
}
.zoom-input {
  width: 84px;
}
.zoom-input :deep(input) {
  text-align: center;
}
</style>
