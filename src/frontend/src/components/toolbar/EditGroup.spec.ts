import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import EditGroup from './EditGroup.vue'
import ToolbarGroup from './ToolbarGroup.vue'
import { useProjectStore } from '../../stores/project'
import { newItem } from '../../types/layout'

const wrappers: ReturnType<typeof mount>[] = []

afterEach(() => {
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
  const wrapper = mount(EditGroup, {
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

describe('EditGroup（编辑分组）', () => {
  it('无选中时复制/删除/组合/解组合全部禁用', async () => {
    await openMenu(createPinia())
    expect(byText('复制选中').disabled).toBe(true)
    expect(byText('删除选中').disabled).toBe(true)
    expect(byText('组合').disabled).toBe(true)
    expect(byText('解组合').disabled).toBe(true)
  })

  it('选中未锁定项后可复制/删除/组合，未组合时解组合仍禁用', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const project = useProjectStore()
    project.doc.items.push(newItem('i1', 'a1'), newItem('i2', 'a2'))
    project.selectedIds = ['i1', 'i2']
    await openMenu(pinia)
    expect(byText('复制选中').disabled).toBe(false)
    expect(byText('删除选中').disabled).toBe(false)
    expect(byText('组合').disabled).toBe(false)
    expect(byText('解组合').disabled).toBe(true)
  })

  it('点击复制选中会复制全部选中项', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const project = useProjectStore()
    project.doc.items.push(newItem('i1', 'a1'), newItem('i2', 'a2'))
    project.selectedIds = ['i1', 'i2']
    await openMenu(pinia)
    byText('复制选中').click()
    await flushPromises()
    expect(project.doc.items.length).toBe(4)
  })

  it('参考线选中时删除优先删参考线、不动照片', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const project = useProjectStore()
    project.doc.items.push(newItem('i1', 'a1'))
    project.doc.guides = [{ id: 'g1', axis: 'x', posMm: 10 }]
    project.selectedIds = ['i1']
    project.selectedGuideIds = ['g1']
    await openMenu(pinia)
    byText('删除选中').click()
    await flushPromises()
    expect(project.doc.guides).toEqual([])
    expect(project.doc.items.length).toBe(1)
  })
})
