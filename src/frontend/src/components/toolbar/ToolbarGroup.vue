<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useSettingsStore } from '../../stores/settings'

const props = withDefaults(
  defineProps<{ groupId: string; icon: string; label: string; width?: string }>(),
  { width: '240px' },
)

const settings = useSettingsStore()
const popoverRef = ref<{ toggle: (e: Event) => void } | null>(null)
const triggerRef = ref<{ $el: HTMLElement } | null>(null)
const visible = ref(false)

// 展开态语义：点击触发钮即写入 store（挂载时若记录展开则初始打开一次）；popover 被
// 外部点击/Esc 收起时由 onHide 回写，避免「关不掉」的错觉。
onMounted(async () => {
  if (!settings.toolbarExpanded[props.groupId]) return
  await nextTick()
  triggerRef.value?.$el.click()
})

function toggle(event: Event) {
  visible.value = !visible.value
  settings.toolbarExpanded[props.groupId] = visible.value
  popoverRef.value?.toggle(event)
}
function onHide() {
  visible.value = false
  settings.toolbarExpanded[props.groupId] = false
}
</script>

<template>
  <div class="toolbar-group">
    <Button
      ref="triggerRef"
      class="group-trigger"
      :class="{ expanded: visible }"
      text
      :aria-expanded="visible"
      :title="`${label}（点击展开/收起）`"
      @click="toggle"
    >
      <i :class="`pi ${icon}`" />
      <span class="group-label">{{ label }}</span>
      <i class="pi pi-chevron-down chevron" :class="{ open: visible }" />
    </Button>
    <Popover ref="popoverRef" @hide="onHide">
      <div class="group-body" :style="{ width }">
        <slot />
      </div>
    </Popover>
  </div>
</template>

<style scoped>
.group-trigger :deep(.p-button-label) {
  flex: none;
}
.group-label {
  margin: 0 2px;
}
.chevron {
  font-size: 10px;
  transition: transform 0.15s;
}
.chevron.open {
  transform: rotate(180deg);
}
.group-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 2px;
}
</style>
