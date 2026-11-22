import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import App from './App.vue'
import { useSettingsStore } from './stores/settings'

// EditorView 依赖 Tauri 运行时，jsdom 中替换为桩
vi.mock('./views/EditorView.vue', () => ({
  default: defineComponent({ template: '<div class="editor-stub">imgLayout 编辑器</div>' }),
}))

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('app-dark')
    setActivePinia(createPinia())
  })

  it('挂载并渲染编辑器', () => {
    const wrapper = mount(App)
    expect(wrapper.find('.editor-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('imgLayout')
  })

  it('默认暗色主题：documentElement 挂 .app-dark', () => {
    mount(App)
    expect(document.documentElement.classList.contains('app-dark')).toBe(true)
  })

  it('切换为亮色后移除 .app-dark', async () => {
    mount(App)
    expect(document.documentElement.classList.contains('app-dark')).toBe(true)
    useSettingsStore().theme = 'light'
    await Promise.resolve()
    expect(document.documentElement.classList.contains('app-dark')).toBe(false)
  })
})
