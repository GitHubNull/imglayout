<script setup lang="ts">
import { computed } from 'vue'
import type { useCanvasView } from '../../composables/useCanvasView'
import type CanvasStage from '../canvas/CanvasStage.vue'
import { useProjectStore } from '../../stores/project'
import { useAssetsStore } from '../../stores/assets'
import { currentProjectPath } from '../../composables/useProjectFile'
import { interactionKind, interactionLabel } from '../../composables/useInteractionStatus'
import ZoomControls from './ZoomControls.vue'
import type { PhotoItem } from '../../types/layout'

defineProps<{
  view: ReturnType<typeof useCanvasView>
  stage: InstanceType<typeof CanvasStage> | null
}>()

const project = useProjectStore()
const assets = useAssetsStore()

function nameOf(item: PhotoItem): string {
  if (item.name) return item.name
  const entry = assets.entries.get(item.assetId)
  return entry ? entry.path.split(/[\\/]/).pop()! : item.assetId
}

const hint = computed(() => {
  if (interactionKind.value !== 'idle') return interactionLabel(interactionKind.value)
  switch (project.doc.mode) {
    case 'free':
      return '单击选择 · 拖动移动 · 空白处拖拽框选 · 滚轮缩放 · 空格+拖动平移'
    case 'grid':
      return '单击选择照片 · 在「布局」面板调整网格排布'
    default:
      return '单击选择照片 · 在「布局」面板调整瀑布流排布'
  }
})

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1)

const selectionInfo = computed(() => {
  const items = project.selectedItems
  if (items.length > 1) return `已选 ${items.length} 张`
  if (items.length === 1) {
    const item = items[0]
    const rect = project.rects[project.doc.items.indexOf(item)]
    if (!rect) return nameOf(item)
    return `${nameOf(item)} · X ${fmt1(rect.xMm)} Y ${fmt1(rect.yMm)} · ${fmt1(rect.wMm)}×${fmt1(rect.hMm)}mm`
  }
  return `${project.doc.items.length} 张 · ${project.doc.canvas.widthMm}×${project.doc.canvas.heightMm}mm`
})

const projectName = computed(() => {
  const p = currentProjectPath.value
  return p ? p.split(/[\\/]/).pop()! : '未命名项目'
})
</script>

<template>
  <footer class="statusbar">
    <span class="hint">{{ hint }}</span>
    <span class="selection" :title="selectionInfo">{{ selectionInfo }}</span>
    <div class="spacer" />
    <ZoomControls :view="view" :stage="stage" />
    <span class="sep" />
    <span class="save-state" :class="{ dirty: project.dirty }">
      <span class="dot" />{{ project.dirty ? '未保存' : '已保存' }}
    </span>
    <span class="project-name" :title="currentProjectPath ?? ''">{{ projectName }}</span>
  </footer>
</template>

<style scoped>
.statusbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 12px;
  border-top: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
  font-size: 12px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}
.hint {
  flex-shrink: 0;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.selection {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.spacer {
  flex: 1;
}
.sep {
  width: 1px;
  height: 16px;
  background: var(--p-content-border-color);
  flex-shrink: 0;
}
.save-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--p-green-500);
}
.dirty .dot {
  background: var(--p-red-500);
}
.project-name {
  flex-shrink: 0;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
