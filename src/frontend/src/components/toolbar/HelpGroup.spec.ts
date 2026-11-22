import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Popover from 'primevue/popover'
import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import HelpGroup from './HelpGroup.vue'
import ToolbarGroup from './ToolbarGroup.vue'
import TutorialDialog from '../help/TutorialDialog.vue'
import AboutDialog from '../help/AboutDialog.vue'
import { useShortcutsStore } from '../../stores/shortcuts'

const wrappers: ReturnType<typeof mount>[] = []

afterEach(() => {
  // Dialog 内容 Teleport 到 body，必须卸载干净，否则会串扰后续用例的 DOM 查询
  for (const w of wrappers.splice(0)) w.unmount()
})

function byText(text: string): HTMLButtonElement {
  const btn = Array.from(document.body.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text),
  )
  if (!btn) throw new Error(`找不到按钮：${text}`)
  return btn as HTMLButtonElement
}

async function openMenu(pinia: Pinia) {
  setActivePinia(pinia)
  const wrapper = mount(HelpGroup, {
    global: {
      plugins: [[PrimeVue, { theme: { preset: Aura } }], pinia],
      components: { Button, Dialog, Popover, ToolbarGroup, TutorialDialog, AboutDialog },
    },
  })
  wrappers.push(wrapper)
  await wrapper.find('.group-trigger').trigger('click')
  await flushPromises()
  return wrapper
}

describe('HelpGroup（帮助分组）', () => {
  it('组内含快捷键设置/使用教程/关于三个入口', async () => {
    await openMenu(createPinia())
    const text = document.body.textContent ?? ''
    expect(text).toContain('快捷键设置')
    expect(text).toContain('使用教程')
    expect(text).toContain('关于 imgLayout')
  })

  it('点击快捷键设置打开设置对话框（store 态）', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const shortcuts = useShortcutsStore()
    await openMenu(pinia)
    byText('快捷键设置').click()
    await flushPromises()
    expect(shortcuts.dialogOpen).toBe(true)
  })

  it('点击使用教程/关于分别弹出对应对话框', async () => {
    await openMenu(createPinia())
    byText('使用教程').click()
    await flushPromises()
    expect(document.body.textContent).toContain('快速开始')
    byText('关于 imgLayout').click()
    await flushPromises()
    expect(document.body.textContent).toContain('MIT License')
  })
})
