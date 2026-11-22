<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open, save } from '@tauri-apps/plugin-dialog'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CanvasStage from '../components/canvas/CanvasStage.vue'
import { useCanvasView } from '../composables/useCanvasView'
import LayoutPanel from '../components/panels/LayoutPanel.vue'
import LayerPanel from '../components/panels/LayerPanel.vue'
import OutputPanel from '../components/panels/OutputPanel.vue'
import PhotoPanel from '../components/panels/PhotoPanel.vue'
import AlignBar from '../components/toolbar/AlignBar.vue'
import { useAssetsStore } from '../stores/assets'
import { useProjectStore } from '../stores/project'
import { useSettingsStore } from '../stores/settings'
import type { AssetEntry, LayoutDoc } from '../types/layout'

const project = useProjectStore()
const assets = useAssetsStore()
const view = useCanvasView()
const settings = useSettingsStore()

const stageRef = ref<InstanceType<typeof CanvasStage> | null>(null)
const exportDialog = ref(false)
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
  const entries = await invoke<AssetEntry[]>('import_assets', { paths: list })
  assets.addAll(entries)
  project.addAssetsAsItems(entries)
}

async function saveProject() {
  const path = await save({
    defaultPath: '未命名.imglayout.json',
    filters: [{ name: 'imgLayout 项目', extensions: ['json'] }],
  })
  if (!path) return
  await invoke('save_project', { path, doc: project.doc, assets: assets.asList() })
}

async function openProject() {
  const path = await open({
    filters: [{ name: 'imgLayout 项目', extensions: ['json'] }],
  })
  if (typeof path !== 'string') return
  const file = await invoke<{ doc: LayoutDoc; assets: AssetEntry[] }>('load_project', { path })
  assets.replaceAll(file.assets)
  project.replaceDoc(file.doc)
}

let unlistenProgress: (() => void) | null = null

async function startExport() {
  exportDialog.value = true
  exporting.value = false
  exportError.value = ''
  exportDone.value = 0
  exportTotal.value = project.doc.items.length
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

function onGlobalKeyDown(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey)) return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    project.undo()
  } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
    e.preventDefault()
    project.redo()
  } else if (e.key === 's') {
    e.preventDefault()
    void saveProject()
  } else if (e.key === 'j') {
    e.preventDefault()
    if (project.selectedIds.length) project.duplicateItems([...project.selectedIds])
  } else if (e.key === 'g' && !e.shiftKey) {
    e.preventDefault()
    project.groupSelection()
  } else if (e.key === 'g' && e.shiftKey) {
    e.preventDefault()
    project.ungroupSelection()
  }
}

function duplicateSelection() {
  if (project.selectedIds.length) project.duplicateItems([...project.selectedIds])
}

function deleteSelection() {
  const ids = project.selectedItems.filter((i) => !i.locked).map((i) => i.id)
  if (ids.length) project.removeItems(ids)
}

let unsubscribeSettings: (() => void) | null = null

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeyDown)
  unsubscribeSettings = settings.$subscribe(() => settings.persist())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeyDown)
  unsubscribeSettings?.()
})
</script>

<template>
  <div class="editor">
    <header class="toolbar">
      <span class="brand">imgLayout</span>
      <Button label="导入照片" icon="pi pi-images" @click="importPhotos" />
      <Button icon="pi pi-save" text title="保存项目 (Ctrl+S)" @click="saveProject" />
      <Button icon="pi pi-folder-open" text title="打开项目" @click="openProject" />
      <span class="sep" />
      <Button icon="pi pi-undo" text :disabled="project.undoStack.length === 0" title="撤销 (Ctrl+Z)" @click="project.undo" />
      <Button icon="pi pi-redo" text :disabled="project.redoStack.length === 0" title="重做 (Ctrl+Shift+Z)" @click="project.redo" />
      <span class="sep" />
      <Button icon="pi pi-copy" text title="复制选中 (Ctrl+J)" :disabled="!project.selectedIds.length" @click="duplicateSelection" />
      <Button icon="pi pi-trash" text severity="danger" title="删除选中 (Delete)" :disabled="!project.selectedItems.some((i) => !i.locked)" @click="deleteSelection" />
      <Button icon="pi pi-sitemap" text title="组合 (Ctrl+G)" :disabled="project.selectedItems.filter((i) => !i.locked && i.groupId == null).length < 2" @click="project.groupSelection()" />
      <Button icon="pi pi-clone" text title="解组合 (Ctrl+Shift+G)" :disabled="!project.selectedItems.some((i) => i.groupId != null)" @click="project.ungroupSelection()" />
      <span class="sep" />
      <AlignBar />
      <div class="spacer" />
      <ToggleButton v-model="settings.gridVisible" on-icon="pi pi-th-large" off-icon="pi pi-th-large" on-label="" off-label="" title="显示网格" />
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
      <ToggleButton v-model="settings.rulerVisible" on-icon="pi pi-table" off-icon="pi pi-table" on-label="" off-label="" title="标尺" />
      <span class="sep" />
      <Button icon="pi pi-minus" text title="缩小" @click="stageRef?.zoomStep(1 / 1.25)" />
      <Button :label="`${view.zoomPercent.value}%`" text class="zoom-readout" title="点击恢复 100%" @click="stageRef?.zoom100()" />
      <Button label="适应" text @click="stageRef?.fitView(); stageRef?.zoomStep(1)" />
      <Button icon="pi pi-plus" text title="放大" @click="stageRef?.zoomStep(1.25)" />
      <span class="zoom">{{ project.doc.items.length }} 张 · {{ project.doc.canvas.widthMm }}×{{ project.doc.canvas.heightMm }}mm</span>
      <Button label="导出…" icon="pi pi-download" @click="startExport" />
    </header>

    <div class="main">
      <aside class="side">
        <Tabs value="output">
          <TabList>
            <Tab value="output">输出</Tab>
            <Tab value="layout">布局</Tab>
            <Tab value="layers">图层</Tab>
            <Tab value="photo">照片</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="output"><OutputPanel /></TabPanel>
            <TabPanel value="layout"><LayoutPanel /></TabPanel>
            <TabPanel value="layers"><LayerPanel /></TabPanel>
            <TabPanel value="photo"><PhotoPanel /></TabPanel>
          </TabPanels>
        </Tabs>
      </aside>
      <div class="stage-wrap">
        <CanvasStage ref="stageRef" :view="view" />
      </div>
    </div>

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
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
}
.brand {
  font-weight: 700;
  margin-right: 12px;
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
  min-width: 0;
}
.side {
  width: 300px;
  flex-shrink: 0;
  border-right: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
  overflow-y: auto;
  overflow-x: hidden;
}
.zoom-readout {
  min-width: 56px;
}
.step-select {
  width: 76px;
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
