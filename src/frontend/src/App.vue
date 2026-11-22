<script setup lang="ts">
import { watchEffect } from 'vue'
import EditorView from './views/EditorView.vue'
import { useSettingsStore } from './stores/settings'

const settings = useSettingsStore()
watchEffect(() => {
  document.documentElement.classList.toggle('app-dark', settings.theme === 'dark')
})
</script>

<template>
  <EditorView />
</template>

