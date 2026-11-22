// 视图/吸附/标尺等编辑器偏好设置，localStorage 持久化（不进项目文档）
import { defineStore } from 'pinia'

const STORAGE_KEY = 'imglayout.settings.v1'

export interface SettingsState {
  theme: 'dark' | 'light'
  gridVisible: boolean
  gridStepMm: number
  gridSnap: boolean
  edgeSnap: boolean
  rulerVisible: boolean
  guidesVisible: boolean
  layerIndexVisible: boolean
}

const DEFAULTS: SettingsState = {
  theme: 'dark',
  gridVisible: true,
  gridStepMm: 5,
  gridSnap: true,
  edgeSnap: true,
  rulerVisible: true,
  guidesVisible: true,
  layerIndexVisible: true,
}

export const GRID_STEP_OPTIONS = [1, 2, 5, 10]

function load(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SettingsState>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => load(),
  actions: {
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
      } catch {
        // 隐私模式等场景下写入失败可忽略
      }
    },
  },
})
