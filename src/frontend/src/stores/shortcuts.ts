// 快捷键键位配置：localStorage 持久化；命令表由 EditorView 启动时注入。
// 旧配置与命令表做并集：新增命令自动补默认绑定，用户已改键位不丢。
import { defineStore } from 'pinia'
import type { ShortcutCommand } from '../lib/shortcuts/commands'

const STORAGE_KEY = 'imglayout.shortcuts.v1'

export type BindingMap = Record<string, string | null>

function loadSaved(): BindingMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as BindingMap
  } catch {
    return {}
  }
}

export const useShortcutsStore = defineStore('shortcuts', {
  state: () => ({
    commands: [] as ShortcutCommand[],
    bindings: {} as BindingMap,
    /** 设置对话框打开期间全局快捷键挂起，避免录键时被误触发 */
    dialogOpen: false,
  }),
  actions: {
    /** EditorView setup 时调用一次；命令列表只读，键位响应式 */
    init(commands: ShortcutCommand[]) {
      if (this.commands.length) return
      this.commands = commands
      const saved = loadSaved()
      const merged: BindingMap = {}
      for (const c of commands) {
        merged[c.id] = c.id in saved ? saved[c.id] : c.defaultBinding
      }
      this.bindings = merged
    },
    bindingOf(id: string): string | null {
      return this.bindings[id] ?? null
    },
    setBinding(id: string, chord: string | null) {
      this.bindings[id] = chord
      this.persist()
    },
    resetDefaults() {
      for (const c of this.commands) this.bindings[c.id] = c.defaultBinding
      this.persist()
    },
    titleOf(id: string): string {
      return this.commands.find((c) => c.id === id)?.title ?? id
    },
    /** 命中键位对应的命令；冲突时取先注册者（冲突在设置对话框中提示） */
    commandFor(chord: string): ShortcutCommand | null {
      return this.commands.find((c) => this.bindings[c.id] === chord) ?? null
    },
    /** 同一键位绑定多个命令的冲突表：键位 → 命令 id 列表 */
    conflicts(): Map<string, string[]> {
      const map = new Map<string, string[]>()
      for (const c of this.commands) {
        const b = this.bindings[c.id]
        if (!b) continue
        const list = map.get(b) ?? []
        list.push(c.id)
        map.set(b, list)
      }
      for (const [chord, ids] of map) {
        if (ids.length < 2) map.delete(chord)
      }
      return map
    },
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bindings))
      } catch {
        // 隐私模式等场景下写入失败可忽略
      }
    },
  },
})
