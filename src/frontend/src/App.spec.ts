import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import App from './App.vue'

// EditorView 依赖 Tauri 运行时，jsdom 中替换为桩
vi.mock('./views/EditorView.vue', () => ({
  default: defineComponent({ template: '<div class="editor-stub">imgLayout 编辑器</div>' }),
}))

describe('App', () => {
  it('挂载并渲染编辑器', () => {
    const wrapper = mount(App)
    expect(wrapper.find('.editor-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('imgLayout')
  })
})
