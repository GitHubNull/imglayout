<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open, save } from '@tauri-apps/plugin-dialog'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CanvasStage from '../components/canvas/CanvasStage.vue'
import LayoutPanel from '../components/panels/LayoutPanel.vue'
import LayerPanel from '../components/panels/LayerPanel.vue'
import OutputPanel from '../components/panels/OutputPanel.vue'
import PhotoPanel from '../components/panels/PhotoPanel.vue'
import { useAssetsStore } from '../stores/assets'
import { useProjectStore } from '../stores/project'
import type { AssetEntry, LayoutDoc } from '../types/layout'

const project = useProjectStore()
const assets = useAssetsStore()

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
  const path = await save({
    defaultPath: `imglayout-${project.doc.canvas.widthMm}x${project.doc.canvas.heightMm}.${exportFormat.value === 'jpeg' ? 'jpg' : 'png'}`,
    filters: [{ name: '图片', extensions: exportFormat.value === 'jpeg' ? ['jpg'] : ['png'] }],
  })
  if (!path) return
  exportDialog.value = true
  exporting.value = true
  exportError.value = ''
  exportDone.value = 0
  exportTotal.value = project.doc.items.length
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
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeyDown))
</script>

<template>
  <div class="editor">
    <header class="toolbar">
      <span class="brand">imgLayout</span>
      <Button label="导入照片" icon="pi pi-images" @click="importPhotos" />
      <Button label="保存" icon="pi pi-save" text @click="saveProject" />
      <Button label="打开" icon="pi pi-folder-open" text @click="openProject" />
      <div class="spacer" />
      <Button icon="pi pi-undo" text :disabled="project.undoStack.length === 0" @click="project.undo" />
      <Button icon="pi pi-redo" text :disabled="project.redoStack.length === 0" @click="project.redo" />
      <div class="spacer" />
      <Button icon="pi pi-minus" text @click="stageRef?.zoomStep(1 / 1.25)" />
      <Button label="适应" text @click="stageRef?.fitView(); stageRef?.zoomStep(1)" />
      <Button label="100%" text @click="stageRef?.zoom100()" />
      <Button icon="pi pi-plus" text @click="stageRef?.zoomStep(1.25)" />
      <span class="zoom">{{ project.doc.items.length }} 张 · {{ project.doc.canvas.widthMm }}×{{ project.doc.canvas.heightMm }}mm</span>
      <Button label="导出…" icon="pi pi-download" @click="startExport" />
    </header>

    <div class="main">
      <div class="stage-wrap">
        <CanvasStage ref="stageRef" />
      </div>
      <aside class="side">
        <Tabs value="output">
          <TabList>
            <Tab value="output">输出</Tab>
            <Tab value="layout">布局</Tab>
            <Tab value="photo">照片</Tab>
            <Tab value="layers">图层</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="output"><OutputPanel /></TabPanel>
            <TabPanel value="layout"><LayoutPanel /></TabPanel>
            <TabPanel value="photo"><PhotoPanel /></TabPanel>
            <TabPanel value="layers"><LayerPanel /></TabPanel>
          </TabPanels>
        </Tabs>
      </aside>
    </div>

    <Dialog v-model:visible="exportDialog" header="导出" :closable="!exporting" :modal="true" :style="{ width: '420px' }">
      <div class="export-body">
        <template v-if="exporting">
          <p>正在合成…（{{ exportDone }}/{{ exportTotal }}）</p>
          <ProgressBar :value="exportTotal ? (exportDone / exportTotal) * 100 : 0" />
        </template>
        <template v-else-if="exportError">
          <p class="error">导出失败：{{ exportError }}</p>
        </template>
        <template v-else>
          <p>导出完成：{{ lastExportPath }}</p>
          <div class="row">
            <Button label="打开所在文件夹" icon="pi pi-folder" @click="openExportFolder" />
            <Button label="关闭" text @click="exportDialog = false" />
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
  border-left: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
  overflow-y: auto;
}
.export-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.error {
  color: var(--p-red-500);
}
.row {
  display: flex;
  gap: 8px;
}
</style>
