<script setup lang="ts">
import { computed, ref } from 'vue'
import { useShortcutsStore } from '../../stores/shortcuts'
import { SHORTCUT_GROUPS } from '../../lib/shortcuts/commands'
import { displayChord, eventToChord } from '../../lib/shortcuts/chords'

const visible = defineModel<boolean>({ required: true })
const shortcuts = useShortcutsStore()
const recordingId = ref<string | null>(null)

const groups = computed(() =>
  SHORTCUT_GROUPS.map((name) => ({
    name,
    items: shortcuts.commands.filter((c) => c.group === name),
  })).filter((g) => g.items.length > 0),
)

const conflictMap = computed(() => shortcuts.conflicts())

/** 该命令当前键位上的其他命令标题；无冲突返回空串 */
function conflictText(id: string): string {
  const binding = shortcuts.bindingOf(id)
  if (!binding) return ''
  const others = (conflictMap.value.get(binding) ?? []).filter((x) => x !== id)
  return others.map((x) => `「${shortcuts.titleOf(x)}」`).join('、')
}

function startRecord(id: string) {
  recordingId.value = id
}

function onRecordKey(e: KeyboardEvent, id: string) {
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') {
    recordingId.value = null
    return
  }
  if (e.key === 'Backspace') {
    shortcuts.setBinding(id, null)
    recordingId.value = null
    return
  }
  const chord = eventToChord(e)
  if (!chord) return
  shortcuts.setBinding(id, chord)
  recordingId.value = null
}
</script>

<template>
  <Dialog v-model:visible="visible" header="快捷键设置" :modal="true" :style="{ width: '520px' }">
    <div class="sc-body">
      <div v-for="group in groups" :key="group.name" class="sc-group">
        <div class="sc-group-title">{{ group.name }}</div>
        <div
          v-for="cmd in group.items"
          :key="cmd.id"
          class="sc-row"
          :class="{ conflict: !!conflictText(cmd.id) }"
        >
          <span class="sc-name">{{ cmd.title }}</span>
          <span v-if="conflictText(cmd.id)" class="sc-conflict">与 {{ conflictText(cmd.id) }} 冲突</span>
          <Button
            v-if="recordingId !== cmd.id"
            :label="shortcuts.bindingOf(cmd.id) ? displayChord(shortcuts.bindingOf(cmd.id)!) : '未绑定'"
            size="small"
            :outlined="!shortcuts.bindingOf(cmd.id)"
            class="sc-key"
            @click="startRecord(cmd.id)"
          />
          <Button
            v-else
            label="按下新键位…（Esc 取消 / ⌫ 清除）"
            size="small"
            class="sc-key recording"
            @keydown.capture="onRecordKey($event, cmd.id)"
          />
        </div>
      </div>
      <p class="sc-note">空格键 = 抓手（平移画布），固定不可改。点击键位按钮后按新组合键即完成改键。</p>
    </div>
    <template #footer>
      <div class="sc-footer">
        <Button label="恢复默认" icon="pi pi-refresh" text @click="shortcuts.resetDefaults()" />
        <Button label="完成" @click="visible = false" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.sc-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sc-group {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  overflow: hidden;
}
.sc-group-title {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  background: var(--p-content-hover-background);
  color: var(--p-text-muted-color);
}
.sc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-top: 1px solid var(--p-content-border-color);
}
.sc-row.conflict {
  background: color-mix(in srgb, var(--p-red-500) 10%, transparent);
}
.sc-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
}
.sc-conflict {
  font-size: 12px;
  color: var(--p-red-500);
  white-space: nowrap;
}
.sc-key {
  flex-shrink: 0;
  min-width: 120px;
  font-family: monospace;
}
.sc-key.recording {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 1px;
}
.sc-note {
  margin: 0;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.sc-footer {
  display: flex;
  justify-content: space-between;
  width: 100%;
}
</style>
