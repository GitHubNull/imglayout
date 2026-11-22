import { useShortcutsStore } from '../stores/shortcuts'
import { displayChord } from '../lib/shortcuts/chords'

/** 顶栏按钮 tooltip：带当前键位，未绑定则只显示标题 */
export function useCommandTip() {
  const shortcuts = useShortcutsStore()
  return function tip(title: string, commandId: string): string {
    const binding = shortcuts.bindingOf(commandId)
    return binding ? `${title} (${displayChord(binding)})` : title
  }
}
