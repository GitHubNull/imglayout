import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from './settings'

describe('settings store 主题字段', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('无存储时默认主题为暗色', () => {
    expect(useSettingsStore().theme).toBe('dark')
  })

  it('旧版存储无 theme 键时合并补默认值 dark', () => {
    localStorage.setItem(
      'imglayout.settings.v1',
      JSON.stringify({ gridVisible: false, gridStepMm: 10 }),
    )
    setActivePinia(createPinia())
    const store = useSettingsStore()
    expect(store.theme).toBe('dark')
    expect(store.gridVisible).toBe(false)
    expect(store.gridStepMm).toBe(10)
  })

  it('persist 写入 theme 且再次加载保留', () => {
    const store = useSettingsStore()
    store.theme = 'light'
    store.persist()
    setActivePinia(createPinia())
    expect(useSettingsStore().theme).toBe('light')
  })
})
