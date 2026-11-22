<script setup lang="ts">
import { ref } from 'vue'
import { useShortcutsStore } from '../../stores/shortcuts'
import ToolbarGroup from './ToolbarGroup.vue'
import TutorialDialog from '../help/TutorialDialog.vue'
import AboutDialog from '../help/AboutDialog.vue'

const shortcuts = useShortcutsStore()
const tutorialVisible = ref(false)
const aboutVisible = ref(false)
</script>

<template>
  <ToolbarGroup group-id="help" icon="pi-question-circle" label="帮助" width="200px">
    <Button label="快捷键设置" icon="pi pi-cog" text class="group-btn" @click="shortcuts.dialogOpen = true" />
    <Button label="使用教程" icon="pi pi-question-circle" text class="group-btn" @click="tutorialVisible = true" />
    <Button label="关于 imgLayout" icon="pi pi-info-circle" text class="group-btn" @click="aboutVisible = true" />
  </ToolbarGroup>
  <TutorialDialog v-model="tutorialVisible" />
  <AboutDialog v-model="aboutVisible" />
</template>

<style scoped>
.group-btn {
  width: 100%;
  justify-content: flex-start;
}
</style>
