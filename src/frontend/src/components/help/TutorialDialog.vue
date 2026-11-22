<script setup lang="ts">
import { computed, ref } from 'vue'
import { TUTORIAL_CHAPTERS } from '../../lib/help/tutorials'

const visible = defineModel<boolean>({ required: true })

const currentIndex = ref(0)
const currentChapter = computed(() => TUTORIAL_CHAPTERS[currentIndex.value])
const chapterCount = TUTORIAL_CHAPTERS.length

function goto(index: number) {
  currentIndex.value = Math.min(chapterCount - 1, Math.max(0, index))
}
</script>

<template>
  <Dialog v-model:visible="visible" header="使用教程" :modal="true" :style="{ width: '640px' }">
    <div class="tu-body">
      <nav class="tu-nav">
        <button
          v-for="(chapter, i) in TUTORIAL_CHAPTERS"
          :key="chapter.id"
          type="button"
          class="tu-nav-item"
          :class="{ active: i === currentIndex }"
          @click="goto(i)"
        >
          <span class="tu-nav-no">{{ i + 1 }}</span>
          <span class="tu-nav-title">{{ chapter.title }}</span>
        </button>
      </nav>
      <div class="tu-content">
        <template v-if="currentChapter">
          <p class="tu-summary">{{ currentChapter.summary }}</p>
          <ol class="tu-steps">
            <li v-for="step in currentChapter.steps" :key="step.title">
              <div class="tu-step-title">{{ step.title }}</div>
              <p class="tu-step-body">{{ step.body }}</p>
            </li>
          </ol>
        </template>
      </div>
    </div>
    <template #footer>
      <div class="tu-footer">
        <Button label="上一章" icon="pi pi-angle-left" text :disabled="currentIndex === 0" @click="goto(currentIndex - 1)" />
        <span class="tu-progress">第 {{ currentIndex + 1 }} / {{ chapterCount }} 章</span>
        <Button
          label="下一章"
          icon="pi pi-angle-right"
          text
          icon-pos="right"
          :disabled="currentIndex === chapterCount - 1"
          @click="goto(currentIndex + 1)"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.tu-body {
  display: flex;
  gap: 16px;
  min-height: 320px;
}
.tu-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
  width: 132px;
}
.tu-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--p-text-color);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.tu-nav-item:hover {
  background: var(--p-content-hover-background);
}
.tu-nav-item.active {
  background: var(--p-highlight-background);
  color: var(--p-highlight-color);
  border-color: var(--p-highlight-background);
}
.tu-nav-no {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--p-content-hover-background);
  color: var(--p-text-muted-color);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tu-nav-item.active .tu-nav-no {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}
.tu-content {
  flex: 1;
  min-width: 0;
  max-height: 360px;
  overflow-y: auto;
}
.tu-summary {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.tu-steps {
  margin: 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  counter-reset: step;
}
.tu-steps li {
  position: relative;
  padding-left: 30px;
  counter-increment: step;
}
.tu-steps li::before {
  content: counter(step);
  position: absolute;
  left: 0;
  top: 1px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--p-highlight-background);
  color: var(--p-highlight-color);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tu-step-title {
  font-size: 13px;
  font-weight: 600;
}
.tu-step-body {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--p-text-muted-color);
}
.tu-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.tu-progress {
  font-size: 12px;
  color: var(--p-text-muted-color);
}
</style>
