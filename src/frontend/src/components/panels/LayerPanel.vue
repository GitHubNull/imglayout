<script setup lang="ts">
import { computed } from 'vue'
import { useAssetsStore } from '../../stores/assets'
import { useProjectStore } from '../../stores/project'
import type { PhotoItem } from '../../types/layout'

const project = useProjectStore()
const assets = useAssetsStore()

// 顶层在前
const layers = computed(() => [...project.doc.items].reverse())

function nameOf(item: PhotoItem): string {
  const entry = assets.entries.get(item.assetId)
  if (!entry) return item.assetId
  return entry.path.split(/[\\/]/).pop() ?? item.assetId
}
</script>

<template>
  <div v-if="layers.length" class="layer-list">
    <div
      v-for="(item, idx) in layers"
      :key="item.id"
      class="layer-row"
      :class="{ active: item.id === project.selectedId }"
      @click="project.select(item.id)"
    >
      <img v-if="assets.thumbUrl(item.assetId)" :src="assets.thumbUrl(item.assetId)!" class="thumb" alt="" />
      <div v-else class="thumb placeholder" />
      <span class="name">{{ nameOf(item) }}</span>
      <Button
        icon="pi pi-arrow-up"
        size="small"
        text
        :disabled="idx === 0"
        @click.stop="project.reorder(item.id, 1)"
      />
      <Button
        icon="pi pi-arrow-down"
        size="small"
        text
        :disabled="idx === layers.length - 1"
        @click.stop="project.reorder(item.id, -1)"
      />
      <Button icon="pi pi-trash" size="small" text severity="danger" @click.stop="project.removeItem(item.id)" />
    </div>
  </div>
  <div v-else class="empty">还没有照片，点击顶栏「导入照片」开始</div>
</template>

<style scoped>
.layer-list {
  display: flex;
  flex-direction: column;
  padding: 6px;
  gap: 2px;
}
.layer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.layer-row:hover {
  background: var(--p-content-hover-background);
}
.layer-row.active {
  background: var(--p-highlight-background);
}
.thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  background: #D8D8D4;
}
.thumb.placeholder {
  flex-shrink: 0;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty {
  padding: 24px 12px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  text-align: center;
}
</style>
