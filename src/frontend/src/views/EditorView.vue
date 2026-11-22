<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open, save } from '@tauri-apps/plugin-dialog'
import { onBeforeUnmount, onMounted, ref, computed } from 'vue'
import CanvasStage from '../components/canvas/CanvasStage.vue'
import { useCanvasView } from '../composables/useCanvasView'
import LayoutPanel from '../components/panels/LayoutPanel.vue'
import LayerPanel from '../components/panels/LayerPanel.vue'
import OutputPanel from '../components/panels/OutputPanel.vue'
import PhotoPanel from '../components/panels/PhotoPanel.vue'
import AlignBar from '../components/toolbar/AlignBar.vue'
import StatusBar from '../components/statusbar/StatusBar.vue'
import { useAssetsStore } from '../stores/assets'
import { useProjectStore } from '../stores/project'
import { useSettingsStore } from '../stores/settings'
import { useShortcutsStore } from '../stores/shortcuts'
import { useProjectFile } from '../composables/useProjectFile'
import { useGlobalShortcuts } from '../composables/useGlobalShortcuts'
import { buildCommands } from '../lib/shortcuts/commands'
import { displayChord } from '../lib/shortcuts/chords'
import ShortcutsDialog from '../components/settings/ShortcutsDialog.vue'
import AboutDialog from '../components/help/AboutDialog.vue'
import TutorialDialog from '../components/help/TutorialDialog.vue'
import type { AssetEntry } from '../types/layout'

const project = useProjectStore()
const assets = useAssetsStore()
const view = useCanvasView()
const settings = useSettingsStore()
const shortcuts = useShortcutsStore()
const projectFile = useProjectFile()

useGlobalShortcuts(
  buildCommands({
    saveProject: projectFile.saveProject,
    saveProjectAs: projectFile.saveProjectAs,
    openProject: projectFile.openProject,
  }),
)

/** 顶栏按钮 tooltip：带当前键位，未绑定则只显示标题 */
function tip(title: string, commandId: string): string {
  const binding = shortcuts.bindingOf(commandId)
  return binding ? `${title} (${displayChord(binding)})` : title
}

const stageRef = ref<InstanceType<typeof CanvasStage> | null>(null)
// ToggleSwitch 是 boolean，store 是 'dark'|'light'，桥接一下
const darkMode = computed({
  get: () => settings.theme === 'dark',
  set: (v: boolean) => {
    settings.theme = v ? 'dark' : 'light'
  },
})
const exportDialog = ref(false)
const tutorialVisible = ref(false)
const aboutVisible = ref(false)
const exporting = ref(false)
const exportDone = ref(0)
const exportTotal = ref(0)
const exportError = ref('')
const exportFormat = ref<'jpeg' | 'png'>('jpeg')
const exportQuality = ref(95)
const lastExportPath = ref('')

async function importPhotos() {
  const paths = await open({
    multiple: true,
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff'] }],
  })
  if (!paths) return
  const list = paths as string[]
  if (list.length === 0) return
  const result = await invoke<{ entries: AssetEntry[]; errors: string[] }>('import_assets', { paths: list })
  assets.addAll(result.entries)
  project.addAssetsAsItems(result.entries)
  if (result.errors.length) {
    window.alert(`以下 ${result.errors.length} 张照片导入失败，其余已导入：\n${result.errors.join('\n')}`)
  }
}

const { saveProject, openProject } = projectFile

let unlistenProgress: (() => void) | null = null

async function startExport() {
  exportDialog.value = true
  exporting.value = false
  exportError.value = ''
  exportDone.value = 0
  exportTotal.value = project.doc.items.filter((i) => i.visible).length
  lastExportPath.value = ''
}

async function confirmExport() {
  const path = await save({
    defaultPath: `imglayout-${project.doc.canvas.widthMm}x${project.doc.canvas.heightMm}.${exportFormat.value === 'jpeg' ? 'jpg' : 'png'}`,
    filters: [{ name: '图片', extensions: exportFormat.value === 'jpeg' ? ['jpg'] : ['png'] }],
  })
  if (!path) return
  exporting.value = true
  exportError.value = ''
  unlistenProgress = await listen<{ done: number; total: number }>('export-progress', (e) => {
    exportDone.value = e.payload.done
    exportTotal.value = e.payload.total
  })
  try {
    await invoke('export_layout_cmd', {
      doc: project.doc,
      assets: assets.asList(),
      outPath: path,
      format: exportFormat.value,
      quality: exportQuality.value,
    })
    lastExportPath.value = path
  } catch (err) {
    exportError.value = String(err)
  } finally {
    exporting.value = false
    unlistenProgress?.()
    unlistenProgress = null
  }
}

async function openExportFolder() {
  if (!lastExportPath.value) return
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
  await revealItemInDir(lastExportPath.value)
}

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

let unsubscribeSettings: (() => void) | null = null

onMounted(() => {
  unsubscribeSettings = settings.$subscribe(() => settings.persist())
})
onBeforeUnmount(() => {
  unsubscribeSettings?.()
})
</script>

<template>
  <div class="editor">
    <header class="toolbar">
      <Button label="导入照片" icon="pi pi-images" @click="importPhotos" />
      <Button icon="pi pi-save" text :title="tip('保存项目', 'save')" @click="saveProject" />
      <Button label="另存为" icon="pi pi-save" text :title="tip('另存为…', 'save-as')" @click="projectFile.saveProjectAs" />
      <Button icon="pi pi-folder-open" text :title="tip('打开项目…', 'open')" @click="openProject" />
      <span class="sep" />
      <Button icon="pi pi-undo" text :disabled="project.undoStack.length === 0" :title="tip('撤销', 'undo')" @click="project.undo" />
      <Button icon="pi pi-refresh" text :disabled="project.redoStack.length === 0" :title="tip('重做', 'redo')" @click="project.redo" />
      <span class="sep" />
      <Button icon="pi pi-copy" text :title="tip('复制选中', 'duplicate')" :disabled="!project.selectedIds.length" @click="duplicateSelection" />
      <Button icon="pi pi-trash" text severity="danger" :title="tip('删除选中', 'delete')" :disabled="!project.selectedItems.some((i) => !i.locked)" @click="deleteSelection" />
      <Button icon="pi pi-sitemap" text :title="tip('组合', 'group')" :disabled="project.selectedItems.filter((i) => !i.locked && i.groupId == null).length < 2" @click="project.groupSelection()" />
      <Button icon="pi pi-clone" text :title="tip('解组合', 'ungroup')" :disabled="!project.selectedItems.some((i) => i.groupId != null)" @click="project.ungroupSelection()" />
      <span class="sep" />
      <AlignBar />
      <div class="spacer" />
      <ToggleButton v-model="settings.gridVisible" on-icon="pi pi-th-large" off-icon="pi pi-th-large" on-label="" off-label="" :title="tip('显示网格', 'toggle-grid')" />
      <Select
        v-model="settings.gridStepMm"
        :options="[
          { label: '1mm', value: 1 },
          { label: '2mm', value: 2 },
          { label: '5mm', value: 5 },
          { label: '10mm', value: 10 },
        ]"
        option-label="label"
        option-value="value"
        size="small"
        class="step-select"
        title="网格间距"
      />
      <ToggleButton v-model="settings.gridSnap" on-icon="pi pi-bolt" off-icon="pi pi-bolt" on-label="" off-label="" title="网格吸附" />
      <ToggleButton v-model="settings.edgeSnap" on-icon="pi pi-arrow-down-left" off-icon="pi pi-arrow-down-left" on-label="" off-label="" title="边缘吸附" />
      <ToggleButton v-model="settings.rulerVisible" on-icon="pi pi-table" off-icon="pi pi-table" on-label="" off-label="" :title="tip('标尺', 'toggle-ruler')" />
      <ToggleButton v-model="settings.guidesVisible" on-icon="pi pi-arrows-alt" off-icon="pi pi-arrows-alt" on-label="" off-label="" :title="tip('参考线', 'toggle-guides')" />
      <Button
        icon="pi pi-times-circle"
        text
        title="清除全部参考线（锁定除外）"
        :disabled="!(project.doc.guides ?? []).some((g) => !g.locked)"
        @click="project.clearGuides()"
      />
      <span class="sep" />
      <span class="zoom">暗色</span>
      <ToggleSwitch v-model="darkMode" title="切换亮/暗主题" />
      <Button icon="pi pi-cog" text title="快捷键设置" @click="shortcuts.dialogOpen = true" />
      <Button icon="pi pi-question-circle" text title="使用教程" @click="tutorialVisible = true" />
      <Button icon="pi pi-info-circle" text title="关于 imgLayout" @click="aboutVisible = true" />
      <Button label="导出…" icon="pi pi-download" @click="startExport" />
    </header>

    <div class="main">
      <aside class="side">
        <Tabs value="layers">
          <TabList>
            <Tab value="layers">图层</Tab>
            <Tab value="photo">照片</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="layers"><LayerPanel /></TabPanel>
            <TabPanel value="photo"><PhotoPanel /></TabPanel>
          </TabPanels>
        </Tabs>
      </aside>
      <div class="stage-wrap">
        <CanvasStage ref="stageRef" :view="view" />
      </div>
      <aside class="side side-right">
        <Tabs value="output">
          <TabList>
            <Tab value="output">输出</Tab>
            <Tab value="layout">布局</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="output"><OutputPanel /></TabPanel>
            <TabPanel value="layout"><LayoutPanel /></TabPanel>
          </TabPanels>
        </Tabs>
      </aside>
    </div>

    <StatusBar :view="view" :stage="stageRef" />

    <Dialog v-model:visible="exportDialog" header="导出" :closable="!exporting" :modal="true" :style="{ width: '420px' }">
      <div class="export-body">
        <template v-if="exporting">
          <p>正在合成…（{{ exportDone }}/{{ exportTotal }}）</p>
          <ProgressBar :value="exportTotal ? (exportDone / exportTotal) * 100 : 0" />
        </template>
        <template v-else-if="exportError">
          <p class="error">导出失败：{{ exportError }}</p>
          <div class="row">
            <Button label="重试" @click="confirmExport" />
            <Button label="关闭" text @click="exportDialog = false" />
          </div>
        </template>
        <template v-else-if="lastExportPath">
          <p>导出完成：{{ lastExportPath }}</p>
          <div class="row">
            <Button label="打开所在文件夹" icon="pi pi-folder" @click="openExportFolder" />
            <Button label="关闭" text @click="exportDialog = false" />
          </div>
        </template>
        <template v-else>
          <label class="field">
            <span>格式</span>
            <SelectButton
              v-model="exportFormat"
              :options="[{ label: 'JPEG', value: 'jpeg' }, { label: 'PNG', value: 'png' }]"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </label>
          <label v-if="exportFormat === 'jpeg'" class="field">
            <span>质量：{{ exportQuality }}</span>
            <Slider v-model="exportQuality" :min="60" :max="100" class="w-full" />
          </label>
          <p class="px-hint">
            输出：{{ project.doc.canvas.widthMm }}×{{ project.doc.canvas.heightMm }}mm @
            {{ project.doc.canvas.dpi }}DPI，共 {{ project.doc.items.length }} 张照片
          </p>
          <div class="row">
            <Button label="开始导出" icon="pi pi-download" @click="confirmExport" />
            <Button label="取消" text @click="exportDialog = false" />
          </div>
        </template>
      </div>
    </Dialog>
    <ShortcutsDialog v-model="shortcuts.dialogOpen" />
    <TutorialDialog v-model="tutorialVisible" />
    <AboutDialog v-model="aboutVisible" />
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
}
.spacer {
  flex: 1;
}
.sep {
  width: 1px;
  height: 20px;
  background: var(--p-content-border-color);
  margin: 0 4px;
  flex-shrink: 0;
}
.zoom {
  font-size: 12px;
  color: var(--p-text-muted-color);
  padding: 0 8px;
  white-space: nowrap;
}
.main {
  flex: 1;
  display: flex;
  min-height: 0;
}
.stage-wrap {
  flex: 1;
  min-width: 280px;
}
.side {
  width: 300px;
  flex-shrink: 0;
  border-right: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
  overflow-y: auto;
  overflow-x: hidden;
}
.side-right {
  border-right: none;
  border-left: 1px solid var(--p-content-border-color);
}
@media (max-width: 1280px) {
  .side,
  .side-right {
    width: 240px;
  }
}
@media (max-width: 1024px) {
  .side,
  .side-right {
    width: 200px;
  }
}
.zoom-readout {
  min-width: 56px;
}
.step-select {
  width: 112px;
  flex-shrink: 0;
}
.export-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.px-hint {
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.error {
  color: var(--p-red-500);
}
.row {
  display: flex;
  gap: 8px;
}
.w-full {
  width: 100%;
}
</style>
