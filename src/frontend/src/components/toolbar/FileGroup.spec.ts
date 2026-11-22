import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import FileGroup from './FileGroup.vue'
import ToolbarGroup from './ToolbarGroup.vue'

const saveProjectAs = vi.fn()
const openProject = vi.fn()

vi.mock('../../composables/useProjectFile', () => ({
  useProjectFile: () => ({ saveProjectAs, openProject, saveProject: vi.fn() }),
}))

const wrappers: ReturnType<typeof mount>[] = []

afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  vi.clearAllMocks()
})

async function openMenu(pinia: Pinia) {
  setActivePinia(pinia)
  const wrapper = mount(FileGroup, {
    global: {
      plugins: [[PrimeVue, { theme: { preset: Aura } }], pinia],
      components: { Button, Popover, ToolbarGroup },
    },
  })
  wrappers.push(wrapper)
  await wrapper.find('.group-trigger').trigger('click')
  await flushPromises()
  return wrapper
}

describe('FileGroup（文件分组）', () => {
  it('组内提供另存为与打开项目', async () => {
    await openMenu(createPinia())
    const labels = Array.from(document.body.querySelectorAll('button')).map((b) => b.textContent ?? '')
    expect(labels.some((t) => t.includes('另存为'))).toBe(true)
    expect(labels.some((t) => t.includes('打开项目'))).toBe(true)
  })

  it('点击另存为/打开项目分别调用对应方法', async () => {
    await openMenu(createPinia())
    const byText = (text: string) =>
      Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes(text))
    byText('另存为')!.click()
    expect(saveProjectAs).toHaveBeenCalledTimes(1)
    byText('打开项目')!.click()
    expect(openProject).toHaveBeenCalledTimes(1)
  })
})
