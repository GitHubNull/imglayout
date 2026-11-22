<script setup lang="ts">
import { computed, ref } from 'vue'
import { boundsOf, type AlignOp } from '../../lib/layout/align'
import { useProjectStore } from '../../stores/project'

const project = useProjectStore()

// 参照物：auto = 多选取选区包围盒、单选取画布；canvas = 强制画布
const alignRef = ref<'auto' | 'canvas'>('auto')

const freeMode = computed(() => project.doc.mode === 'free')
const selectedCount = computed(() => project.selectedItems.length)

const refRect = computed(() => {
  const c = project.doc.canvas
  const canvasRect = { xMm: 0, yMm: 0, wMm: c.widthMm, hMm: c.heightMm }
  if (alignRef.value === 'canvas') return canvasRect
  const items = project.selectedItems
  if (items.length < 2) return canvasRect
  return boundsOf(items.map((i) => i.rect))
})

function apply(mode: AlignOp) {
  project.alignSelection(mode, refRect.value)
}

const buttons: { mode: AlignOp; icon: string; rot?: boolean; title: string }[] = [
  { mode: 'left', icon: 'pi-align-left', title: '左对齐' },
  { mode: 'h-center', icon: 'pi-align-center', title: '水平居中' },
  { mode: 'right', icon: 'pi-align-right', title: '右对齐' },
  { mode: 'top', icon: 'pi-align-left', rot: true, title: '顶部对齐' },
  { mode: 'v-center', icon: 'pi-align-center', rot: true, title: '垂直居中' },
  { mode: 'bottom', icon: 'pi-align-right', rot: true, title: '底部对齐' },
]
const distButtons: { mode: AlignOp; icon: string; title: string }[] = [
  { mode: 'distribute-h', icon: 'pi-ellipsis-h', title: '水平平均分布' },
  { mode: 'distribute-v', icon: 'pi-ellipsis-v', title: '垂直平均分布' },
]
</script>

<template>
  <div class="align-bar" :class="{ disabled: !freeMode }">
    <template v-for="b in buttons" :key="b.mode">
      <Button
        :icon="`pi ${b.icon}`"
        :class="{ rot90: b.rot }"
        text
        :disabled="!freeMode || selectedCount < 1"
        :title="b.title"
        @click="apply(b.mode)"
      />
    </template>
    <span class="sep" />
    <Button
      v-for="b in distButtons"
      :key="b.mode"
      :icon="`pi ${b.icon}`"
      text
      :disabled="!freeMode || selectedCount < 3"
      :title="b.title"
      @click="apply(b.mode)"
    />
    <Select
      v-model="alignRef"
      :options="[
        { label: '自动', value: 'auto' },
        { label: '画布', value: 'canvas' },
      ]"
      option-label="label"
      option-value="value"
      size="small"
      class="ref-select"
      :disabled="!freeMode"
      title="对齐参照：自动 = 多选按选区包围盒、单选按画布"
    />
  </div>
</template>

<style scoped>
.align-bar {
  display: flex;
  align-items: center;
  gap: 2px;
}
.align-bar.disabled {
  opacity: 0.55;
}
.rot90 :deep(.pi) {
  transform: rotate(90deg);
}
.sep {
  width: 1px;
  height: 18px;
  background: var(--p-content-border-color);
  margin: 0 4px;
}
.ref-select {
  width: 74px;
  margin-left: 4px;
}
</style>
