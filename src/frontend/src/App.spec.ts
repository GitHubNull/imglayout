import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from './App.vue'

describe('App', () => {
  it('挂载骨架并显示标题', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('imgLayout')
  })
})
