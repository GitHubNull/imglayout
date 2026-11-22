<script setup lang="ts">
import { useProjectStore } from '../../stores/project'
import { useCommandTip } from '../../composables/useCommandTip'
import ToolbarGroup from './ToolbarGroup.vue'

const project = useProjectStore()
const tip = useCommandTip()

function duplicateSelection() {
  if (project.selectedIds.length) project.duplicateItems([...project.selectedIds])
}

function deleteSelection() {
  // 与 Delete 快捷键同口径：参考线选中优先删参考线
  if (project.selectedGuideIds.length) {
    project.removeGuides([...project.selectedGuideIds])
    return
  }
  const ids = project.selectedItems.filter((i) => !i.locked).map((i) => i.id)
  if (ids.length) project.removeItems(ids)
}
</script>

<template>
  <ToolbarGroup group-id="edit" icon="pi-pencil" label="编辑" width="200px">
    <Button label="复制选中" icon="pi pi-copy" text class="group-btn" :title="tip('复制选中', 'duplicate')" :disabled="!project.selectedIds.length" @click="duplicateSelection" />
    <Button label="删除选中" icon="pi pi-trash" text severity="danger" class="group-btn" :title="tip('删除选中', 'delete')" :disabled="!project.selectedItems.some((i) => !i.locked)" @click="deleteSelection" />
    <Button label="组合" icon="pi pi-sitemap" text class="group-btn" :title="tip('组合', 'group')" :disabled="project.selectedItems.filter((i) => !i.locked && i.groupId == null).length < 2" @click="project.groupSelection()" />
    <Button label="解组合" icon="pi pi-clone" text class="group-btn" :title="tip('解组合', 'ungroup')" :disabled="!project.selectedItems.some((i) => i.groupId != null)" @click="project.ungroupSelection()" />
  </ToolbarGroup>
</template>

<style scoped>
.group-btn {
  width: 100%;
  justify-content: flex-start;
}
</style>
