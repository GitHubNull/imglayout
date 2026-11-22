// 键位（chord）规范化与展示工具。
// 规范形式："Ctrl+Shift+Z"（修饰键按 Ctrl、Alt、Shift 顺序，主键归一大小写）。

/** 把键盘事件归一化为键位字符串；纯修饰键返回 null（不可作为绑定） */
export function eventToChord(e: KeyboardEvent): string | null {
  if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  parts.push(key)
  return parts.join('+')
}

/** 输入控件/富文本内的按键不触发全局快捷键 */
export function isEditableTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  )
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

/** 展示层：mac 上把修饰键换成符号，仅用于显示，存储仍是规范形式 */
export function displayChord(chord: string): string {
  if (!IS_MAC) return chord
  return chord
    .replace(/^Ctrl\+/, '⌘')
    .replace(/^Alt\+/, '⌥')
    .replace(/^Shift\+/, '⇧')
    .replace(/\+Ctrl$/, '+⌘')
}
