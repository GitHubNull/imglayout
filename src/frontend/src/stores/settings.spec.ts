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

  it('layerIndexVisible 默认 true，旧存储无该键时合并补默认 true', () => {
    expect(useSettingsStore().layerIndexVisible).toBe(true)
    localStorage.setItem('imglayout.settings.v1', JSON.stringify({ theme: 'light' }))
    setActivePinia(createPinia())
    const store = useSettingsStore()
    expect(store.theme).toBe('light')
    expect(store.layerIndexVisible).toBe(true)
  })
})

describe('settings store 顶栏分组展开态', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('toolbarExpanded 默认空对象（全部分组收起）', () => {
    expect(useSettingsStore().toolbarExpanded).toEqual({})
  })

  it('旧存储无 toolbarExpanded 键时合并补空对象', () => {
    localStorage.setItem('imglayout.settings.v1', JSON.stringify({ theme: 'light' }))
    setActivePinia(createPinia())
    expect(useSettingsStore().toolbarExpanded).toEqual({})
  })

  it('persist 写入 toolbarExpanded 且再次加载保留', () => {
    const store = useSettingsStore()
    store.toolbarExpanded = { view: true }
    store.persist()
    setActivePinia(createPinia())
    expect(useSettingsStore().toolbarExpanded).toEqual({ view: true })
  })
})
