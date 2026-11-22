// 全局快捷键派发：单一 window keydown 监听 → 规范化键位 → 命令注册表执行。
// 输入控件内、设置对话框打开期间一律挂起。
import { onBeforeUnmount, onMounted } from 'vue'
import { useShortcutsStore } from '../stores/shortcuts'
import { eventToChord, isEditableTarget } from '../lib/shortcuts/chords'
import type { ShortcutCommand } from '../lib/shortcuts/commands'

export function useGlobalShortcuts(commands: ShortcutCommand[]) {
  const shortcuts = useShortcutsStore()
  shortcuts.init(commands)

  function onKeyDown(e: KeyboardEvent) {
    if (isEditableTarget(e.target)) return
    if (shortcuts.dialogOpen) return
    const chord = eventToChord(e)
    if (!chord) return
    const cmd = shortcuts.commandFor(chord)
    if (!cmd) return
    e.preventDefault()
    cmd.run()
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
}
