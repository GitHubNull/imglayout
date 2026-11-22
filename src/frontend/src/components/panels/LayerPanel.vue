<script setup lang="ts">
import { computed, nextTick, ref, type ComponentPublicInstance } from 'vue'
import { useAssetsStore } from '../../stores/assets'
import { useProjectStore } from '../../stores/project'
import type { PhotoItem } from '../../types/layout'

const project = useProjectStore()
const assets = useAssetsStore()

// PS 图层语义：列表顶部 = 最顶层 = items 数组末尾
const allLayers = computed(() => [...project.doc.items].reverse())

// ---- 搜索过滤 ----
const query = ref('')
const layers = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return allLayers.value
  return allLayers.value.filter((item) => nameOf(item).toLowerCase().includes(q))
})
const filterActive = computed(() => query.value.trim().length > 0)

function nameOf(item: PhotoItem): string {
  if (item.name) return item.name
  const entry = assets.entries.get(item.assetId)
  return entry ? entry.path.split(/[\\/]/).pop()! : item.assetId
}

function toggleVisible(item: PhotoItem) {
  project.snapshot()
  project.updateItem(item.id, { visible: !item.visible })
}

function toggleLocked(item: PhotoItem) {
  project.snapshot()
  project.updateItem(item.id, { locked: !item.locked })
}

function setOpacity(item: PhotoItem, percent: number | number[] | undefined) {
  if (typeof percent !== 'number') return
  project.updateItem(item.id, { opacity: Math.min(100, Math.max(0, percent)) / 100 })
}

// ---- 双击重命名 ----
const editingId = ref<string | null>(null)
const draftName = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

// InputText 的根元素即 input
function setRenameRef(el: Element | ComponentPublicInstance | null) {
  renameInput.value = el instanceof HTMLInputElement ? el : null
}

function startRename(item: PhotoItem) {
  editingId.value = item.id
  draftName.value = nameOf(item)
  void nextTick(() => renameInput.value?.select())
}

function commitRename(item: PhotoItem) {
  if (editingId.value !== item.id) return
  editingId.value = null
  const next = draftName.value.trim()
  if ((next || null) === item.name) return
  project.snapshot()
  project.updateItem(item.id, { name: next || null })
}

function cancelRename() {
  editingId.value = null
}

// ---- 拖拽排序（HTML5 DnD）；搜索过滤态下禁用 ----
const dragId = ref<string | null>(null)
/** 插入到该显示行之前；等于 layers.length 表示插到最底 */
const dropPos = ref<number | null>(null)

function onDragStart(item: PhotoItem, e: DragEvent) {
  if (filterActive.value) return
  dragId.value = item.id
  e.dataTransfer?.setData('text/plain', item.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(idx: number, e: DragEvent) {
  if (!dragId.value || filterActive.value) return
  e.preventDefault()
  const row = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const before = e.clientY < row.top + row.height / 2
  dropPos.value = before ? idx : idx + 1
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onTailDragOver(e: DragEvent) {
  if (!dragId.value || filterActive.value) return
  e.preventDefault()
  dropPos.value = layers.value.length
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  if (filterActive.value) return
  const id = dragId.value
  const pos = dropPos.value
  dragId.value = null
  dropPos.value = null
  if (!id || pos == null) return
  const items = project.doc.items
  const from = items.findIndex((i) => i.id === id)
  if (from < 0) return
  // 显示位置 pos（0=顶）换算为 items 数组坐标：顶=items.length，底=0
  const coord = items.length - pos
  const to = from < coord ? coord - 1 : coord
  project.moveItem(id, to)
}

function isDropBefore(idx: number): boolean {
  return dragId.value !== null && dropPos.value === idx
}

function onRowClick(item: PhotoItem, e: MouseEvent) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) project.toggleSelect(item.id)
  else project.select(item.id)
}

const selected = computed(() => project.selectedItem)
const selectedSet = computed(() => new Set(project.selectedIds))
</script>

<template>
  <div class="layer-panel">
    <div class="layer-search">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="query" placeholder="搜索图层" size="small" class="w-full" />
      </IconField>
    </div>
    <div v-if="layers.length" class="layer-list">
      <div
        v-for="(item, idx) in layers"
        :key="item.id"
        class="layer-row"
        :class="{
          active: selectedSet.has(item.id),
          primary: item.id === project.selectedItem?.id,
          hidden: !item.visible,
          'drop-before': isDropBefore(idx),
        }"
        :draggable="!filterActive"
        @click="onRowClick(item, $event)"
        @dragstart="onDragStart(item, $event)"
        @dragover="onDragOver(idx, $event)"
        @drop="onDrop"
        @dragend="dragId = null; dropPos = null"
      >
        <Button
          :icon="item.visible ? 'pi pi-eye' : 'pi pi-eye-slash'"
          class="eye"
          :severity="item.visible ? 'secondary' : 'warn'"
          text
          rounded
          :title="item.visible ? '隐藏图层' : '显示图层'"
          @click.stop="toggleVisible(item)"
        />
        <img v-if="assets.thumbUrl(item.assetId)" :src="assets.thumbUrl(item.assetId)!" class="thumb" alt="" draggable="false" />
        <div v-else class="thumb placeholder" />
        <InputText
          v-if="editingId === item.id"
          :ref="setRenameRef"
          v-model="draftName"
          class="name-input"
          size="small"
          @keydown.enter="commitRename(item)"
          @keydown.esc="cancelRename"
          @blur="commitRename(item)"
        />
        <span v-else class="name" :title="nameOf(item)" @dblclick.stop="startRename(item)">{{ nameOf(item) }}</span>
        <Button
          :icon="item.locked ? 'pi pi-lock' : 'pi pi-unlock'"
          class="lock"
          :severity="item.locked ? 'warn' : 'secondary'"
          text
          rounded
          :title="item.locked ? '解锁图层' : '锁定图层'"
          @click.stop="toggleLocked(item)"
        />
      </div>
      <div class="drop-tail" @dragover="onTailDragOver" @drop="onDrop" />
    </div>
    <div v-else-if="filterActive" class="empty">无匹配图层</div>
    <div v-else class="empty">还没有照片，点击顶栏「导入照片」开始</div>

    <div v-if="selected" class="layer-footer">
      <label class="field">
        <span>不透明度：{{ Math.round(selected.opacity * 100) }}%</span>
        <Slider :model-value="selected.opacity * 100" :min="0" :max="100" class="w-full" @update:model-value="setOpacity(selected, $event)" @slideend="project.snapshot()" />
      </label>
      <div class="footer-actions">
        <Button label="复制图层" icon="pi pi-copy" size="small" text @click="project.duplicateItem(selected.id)" />
        <Button
          label="删除图层"
          icon="pi pi-trash"
          size="small"
          text
          severity="danger"
          @click="project.removeItem(selected.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.layer-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.layer-search {
  padding: 8px 8px 4px;
}
.layer-list {
  flex: 1;
  min-height: 180px;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.layer-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  border-top: 2px solid transparent;
}
.layer-row:hover {
  background: var(--p-content-hover-background);
}
.layer-row.active {
  background: var(--p-highlight-background);
}
.layer-row.hidden {
  opacity: 0.45;
}
.layer-row.drop-before {
  border-top-color: var(--p-primary-color);
}
.drop-line {
  height: 2px;
  background: var(--p-primary-color);
  margin: 2px 4px;
}
.drop-tail {
  height: 8px;
  flex-shrink: 0;
}
.eye,
.lock {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
}
.thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  background: #d8d8d4;
  flex-shrink: 0;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name-input {
  flex: 1;
  min-width: 0;
}
.empty {
  padding: 24px 12px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  text-align: center;
}
.layer-footer {
  border-top: 1px solid var(--p-content-border-color);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.footer-actions {
  display: flex;
  justify-content: space-between;
}
.w-full {
  width: 100%;
}
</style>
