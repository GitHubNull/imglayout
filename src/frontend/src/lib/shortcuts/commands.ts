// 快捷键命令注册表：命令 = id + 标题 + 分组 + 默认键位 + 执行闭包。
// 在此登记新命令后，设置对话框自动列出、默认绑定自动生效、键位可配置。
import { useProjectStore } from '../../stores/project'
import { useSettingsStore } from '../../stores/settings'

export type ShortcutGroup = '项目' | '编辑' | '选择' | '视图'

export interface ShortcutCommand {
  id: string
  title: string
  group: ShortcutGroup
  /** 规范化键位（如 "Ctrl+Shift+Z"）；null = 默认无绑定，可在设置中配置 */
  defaultBinding: string | null
  run: () => void
}

/** 项目文件操作由调用方注入（避免 commands → composables 反向依赖） */
export interface CommandDeps {
  saveProject: () => Promise<void>
  saveProjectAs: () => Promise<void>
  openProject: () => Promise<void>
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = ['项目', '编辑', '选择', '视图']

export function buildCommands(deps: CommandDeps): ShortcutCommand[] {
  const project = useProjectStore()
  const settings = useSettingsStore()
  const run = (fn: () => void) => () => fn()

  return [
    // ---- 项目 ----
    { id: 'save', title: '保存项目', group: '项目', defaultBinding: 'Ctrl+S', run: () => void deps.saveProject() },
    { id: 'save-as', title: '另存为…', group: '项目', defaultBinding: 'Ctrl+Shift+S', run: () => void deps.saveProjectAs() },
    { id: 'open', title: '打开项目…', group: '项目', defaultBinding: 'Ctrl+O', run: () => void deps.openProject() },
    // ---- 编辑 ----
    { id: 'undo', title: '撤销', group: '编辑', defaultBinding: 'Ctrl+Z', run: run(() => project.undo()) },
    { id: 'redo', title: '重做', group: '编辑', defaultBinding: 'Ctrl+Shift+Z', run: run(() => project.redo()) },
    {
      id: 'duplicate',
      title: '复制选中',
      group: '编辑',
      defaultBinding: 'Ctrl+J',
      run: () => {
        if (project.selectedIds.length) project.duplicateItems([...project.selectedIds])
      },
    },
    {
      id: 'delete',
      title: '删除选中',
      group: '编辑',
      defaultBinding: 'Delete',
      run: () => {
        // 参考线选中优先删参考线；否则删除未锁定图层
        if (project.selectedGuideIds.length) {
          project.removeGuides([...project.selectedGuideIds])
          return
        }
        const ids = project.selectedItems.filter((i) => !i.locked).map((i) => i.id)
        if (ids.length) project.removeItems(ids)
      },
    },
    { id: 'group', title: '组合', group: '编辑', defaultBinding: 'Ctrl+G', run: run(() => project.groupSelection()) },
    { id: 'ungroup', title: '解组合', group: '编辑', defaultBinding: 'Ctrl+Shift+G', run: run(() => project.ungroupSelection()) },
    // ---- 选择 ----
    {
      id: 'deselect',
      title: '取消选择',
      group: '选择',
      defaultBinding: 'Escape',
      run: () => {
        project.clearSelection()
        project.clearGuideSelection()
        // 画布内局部状态（参考线精确编辑弹层）由监听方自行清理
        window.dispatchEvent(new CustomEvent('imglayout:escape'))
      },
    },
    { id: 'nudge-left', title: '左移 1mm', group: '选择', defaultBinding: 'Shift+ArrowLeft', run: run(() => project.nudgeSelection(-1, 0)) },
    { id: 'nudge-right', title: '右移 1mm', group: '选择', defaultBinding: 'Shift+ArrowRight', run: run(() => project.nudgeSelection(1, 0)) },
    { id: 'nudge-up', title: '上移 1mm', group: '选择', defaultBinding: 'Shift+ArrowUp', run: run(() => project.nudgeSelection(0, -1)) },
    { id: 'nudge-down', title: '下移 1mm', group: '选择', defaultBinding: 'Shift+ArrowDown', run: run(() => project.nudgeSelection(0, 1)) },
    // ---- 视图（默认键位对齐 PS 口径）----
    { id: 'toggle-grid', title: '显示网格', group: '视图', defaultBinding: "Ctrl+'", run: run(() => { settings.gridVisible = !settings.gridVisible }) },
    { id: 'toggle-ruler', title: '标尺', group: '视图', defaultBinding: 'Ctrl+R', run: run(() => { settings.rulerVisible = !settings.rulerVisible }) },
    { id: 'toggle-guides', title: '参考线', group: '视图', defaultBinding: 'Ctrl+;', run: run(() => { settings.guidesVisible = !settings.guidesVisible }) },
    {
      id: 'toggle-snap',
      title: '吸附（网格 + 边缘）',
      group: '视图',
      defaultBinding: null,
      run: () => {
        const next = !(settings.gridSnap && settings.edgeSnap)
        settings.gridSnap = next
        settings.edgeSnap = next
      },
    },
  ]
}
