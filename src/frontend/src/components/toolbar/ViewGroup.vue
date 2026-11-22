<script setup lang="ts">
import { useProjectStore } from '../../stores/project'
import { useSettingsStore } from '../../stores/settings'
import { useCommandTip } from '../../composables/useCommandTip'
import ToolbarGroup from './ToolbarGroup.vue'

const project = useProjectStore()
const settings = useSettingsStore()
const tip = useCommandTip()
</script>

<template>
  <ToolbarGroup group-id="view" icon="pi-eye" label="视图" width="280px">
    <div class="row">
      <ToggleButton v-model="settings.gridVisible" on-icon="pi pi-th-large" off-icon="pi pi-th-large" on-label="" off-label="" :title="tip('显示网格', 'toggle-grid')" />
      <Select
        v-model="settings.gridStepMm"
        :options="[
          { label: '网格间距 1mm', value: 1 },
          { label: '网格间距 2mm', value: 2 },
          { label: '网格间距 5mm', value: 5 },
          { label: '网格间距 10mm', value: 10 },
        ]"
        option-label="label"
        option-value="value"
        size="small"
        class="step-select"
        :append-to="'body'"
      />
    </div>
    <div class="row">
      <ToggleButton v-model="settings.gridSnap" on-icon="pi pi-bolt" off-icon="pi pi-bolt" on-label="" off-label="" title="网格吸附" />
      <ToggleButton v-model="settings.edgeSnap" on-icon="pi pi-arrow-down-left" off-icon="pi pi-arrow-down-left" on-label="" off-label="" title="边缘吸附" />
    </div>
    <div class="row">
      <ToggleButton v-model="settings.rulerVisible" on-icon="pi pi-table" off-icon="pi pi-table" on-label="" off-label="" :title="tip('标尺', 'toggle-ruler')" />
      <ToggleButton v-model="settings.guidesVisible" on-icon="pi pi-arrows-alt" off-icon="pi pi-arrows-alt" on-label="" off-label="" :title="tip('参考线', 'toggle-guides')" />
      <Button
        icon="pi pi-times-circle"
        text
        title="清除全部参考线（锁定除外）"
        :disabled="!(project.doc.guides ?? []).some((g) => !g.locked)"
        @click="project.clearGuides()"
      />
    </div>
  </ToolbarGroup>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.step-select {
  flex: 1;
  min-width: 110px;
}
</style>
