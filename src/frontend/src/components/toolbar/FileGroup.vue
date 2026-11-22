<script setup lang="ts">
import { useProjectFile } from '../../composables/useProjectFile'
import { useCommandTip } from '../../composables/useCommandTip'
import ToolbarGroup from './ToolbarGroup.vue'

const projectFile = useProjectFile()
const tip = useCommandTip()
</script>

<template>
  <ToolbarGroup group-id="file" icon="pi-file" label="文件" width="200px">
    <Button label="另存为…" icon="pi pi-save" text class="group-btn" :title="tip('另存为…', 'save-as')" @click="projectFile.saveProjectAs" />
    <Button label="打开项目…" icon="pi pi-folder-open" text class="group-btn" :title="tip('打开项目…', 'open')" @click="projectFile.openProject" />
  </ToolbarGroup>
</template>

<style scoped>
.group-btn {
  width: 100%;
  justify-content: flex-start;
}
</style>
