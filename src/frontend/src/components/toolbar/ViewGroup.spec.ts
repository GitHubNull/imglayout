import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import ToggleButton from 'primevue/togglebutton'
import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import ViewGroup from './ViewGroup.vue'
import ToolbarGroup from './ToolbarGroup.vue'
import { useProjectStore } from '../../stores/project'
import { useSettingsStore } from '../../stores/settings'

const wrappers: ReturnType<typeof mount>[] = []

// jsdom 无 matchMedia，PrimeVue Select 挂载时会调用
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia

afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
})

async function openMenu(pinia: Pinia) {
  setActivePinia(pinia)
  const wrapper = mount(ViewGroup, {
    global: {
      plugins: [[PrimeVue, { theme: { preset: Aura } }], pinia],
      components: { Button, Popover, Select, ToggleButton, ToolbarGroup },
    },
  })
  wrappers.push(wrapper)
  await wrapper.find('.group-trigger').trigger('click')
  await flushPromises()
  return wrapper
}

function toggleByTitle(title: string): HTMLButtonElement {
  const btn = document.body.querySelector<HTMLButtonElement>(`button[title^="${title}"]`)
  if (!btn) throw new Error(`找不到开关：${title}`)
  return btn
}

describe('ViewGroup（视图分组）', () => {
  it('组内含网格间距下拉与视图开关', async () => {
    await openMenu(createPinia())
    expect(document.body.querySelector('.step-select')).toBeTruthy()
    expect(document.body.querySelector('button[title="网格吸附"]')).toBeTruthy()
    expect(document.body.querySelector('button[title="边缘吸附"]')).toBeTruthy()
  })

  it('点击开关双向绑定 settings', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const settings = useSettingsStore()
    expect(settings.gridVisible).toBe(true)
    await openMenu(pinia)
    toggleByTitle('显示网格').click()
    await flushPromises()
    expect(settings.gridVisible).toBe(false)
    toggleByTitle('网格吸附').click()
    await flushPromises()
    expect(settings.gridSnap).toBe(false)
  })

  it('清除参考线随未锁定参考线存在与否启用/禁用', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const project = useProjectStore()
    await openMenu(pinia)
    expect(toggleByTitle('清除全部参考线').disabled).toBe(true)
    project.doc.guides = [
      { id: 'g1', axis: 'x', posMm: 10 },
      { id: 'g2', axis: 'y', posMm: 20, locked: true },
    ]
    await flushPromises()
    expect(toggleByTitle('清除全部参考线').disabled).toBe(false)
    toggleByTitle('清除全部参考线').click()
    await flushPromises()
    // 锁定参考线保留
    expect(project.doc.guides.map((g) => g.id)).toEqual(['g2'])
  })
})
