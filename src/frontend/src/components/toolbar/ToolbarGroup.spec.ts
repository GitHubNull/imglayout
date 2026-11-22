import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import ToolbarGroup from './ToolbarGroup.vue'
import { useSettingsStore } from '../../stores/settings'

const wrappers: ReturnType<typeof mount>[] = []

afterEach(() => {
  // Popover 内容 Teleport 到 body，必须卸载干净，否则会串扰后续用例的 DOM 查询
  for (const w of wrappers.splice(0)) w.unmount()
  localStorage.clear()
})

function mountGroup(pinia: Pinia, toolbarExpanded: Record<string, boolean> = {}) {
  setActivePinia(pinia)
  useSettingsStore().toolbarExpanded = toolbarExpanded
  const wrapper = mount(ToolbarGroup, {
    props: { groupId: 'test', icon: 'pi-file', label: '测试' },
    global: {
      plugins: [[PrimeVue, { theme: { preset: Aura } }], pinia],
      components: { Button, Popover },
    },
    slots: { default: '<button class="slot-btn">组内按钮</button>' },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('ToolbarGroup（顶栏分组下拉）', () => {
  it('触发钮渲染组名与图标', () => {
    const wrapper = mountGroup(createPinia())
    const trigger = wrapper.find('.group-trigger')
    expect(trigger.text()).toContain('测试')
    expect(trigger.find('i.pi-file').exists()).toBe(true)
    expect(trigger.find('i.pi-chevron-down').exists()).toBe(true)
  })

  it('默认收起：popover 内容不渲染，展开态无记录', async () => {
    mountGroup(createPinia())
    await flushPromises()
    expect(document.body.querySelector('.slot-btn')).toBeNull()
    expect(useSettingsStore().toolbarExpanded['test']).toBeFalsy()
  })

  it('点击触发钮展开下拉并记录展开态', async () => {
    const pinia = createPinia()
    const wrapper = mountGroup(pinia)
    await wrapper.find('.group-trigger').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('.slot-btn')).toBeTruthy()
    expect(useSettingsStore().toolbarExpanded['test']).toBe(true)
  })

  it('再点击收起并回写收起态', async () => {
    const pinia = createPinia()
    const wrapper = mountGroup(pinia)
    await wrapper.find('.group-trigger').trigger('click')
    await flushPromises()
    await wrapper.find('.group-trigger').trigger('click')
    await flushPromises()
    expect(useSettingsStore().toolbarExpanded['test']).toBe(false)
  })

  it('挂载时若上次记录展开则初始打开一次', async () => {
    mountGroup(createPinia(), { test: true })
    await flushPromises()
    expect(document.body.querySelector('.slot-btn')).toBeTruthy()
  })
})
