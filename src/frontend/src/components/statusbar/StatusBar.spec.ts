import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { nextTick } from 'vue'
import StatusBar from './StatusBar.vue'
import { useProjectStore } from '../../stores/project'
import { newItem } from '../../types/layout'
import { useCanvasView } from '../../composables/useCanvasView'
import { currentProjectPath } from '../../composables/useProjectFile'
import { interactionKind } from '../../composables/useInteractionStatus'

function mountBar(pinia: Pinia) {
  return mount(StatusBar, {
    props: { view: useCanvasView(), stage: null },
    global: {
      plugins: [pinia],
      stubs: { Button: true, InputNumber: true },
    },
  })
}

describe('StatusBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentProjectPath.value = null
    interactionKind.value = 'idle'
  })

  it('空闲态显示自由模式默认操作提示', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useProjectStore().doc.mode = 'free'
    const wrapper = mountBar(pinia)
    expect(wrapper.find('.hint').text()).toContain('单击选择')
  })

  it('交互态显示当前交互文案，松手回空闲', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useProjectStore().doc.mode = 'free'
    const wrapper = mountBar(pinia)
    interactionKind.value = 'marquee'
    await nextTick()
    expect(wrapper.find('.hint').text()).toBe('框选选择…')
    interactionKind.value = 'idle'
    await nextTick()
    expect(wrapper.find('.hint').text()).toContain('单击选择')
  })

  it('单选显示名称与位置尺寸（rect 取 rects 口径）', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const project = useProjectStore()
    project.doc.mode = 'free'
    project.doc.items.push({ ...newItem('a', 'asset-a'), name: '海边', rect: { xMm: 10, yMm: 20, wMm: 60, hMm: 45 } })
    project.selectedIds = ['a']
    const wrapper = mountBar(pinia)
    const text = wrapper.find('.selection').text()
    expect(text).toContain('海边')
    expect(text).toContain('X 10.0 Y 20.0')
    expect(text).toContain('60.0×45.0mm')
  })

  it('多选显示数量，无选中显示画布规格', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const project = useProjectStore()
    project.doc.mode = 'free'
    project.doc.items.push(
      { ...newItem('a', 'asset-a'), rect: { xMm: 0, yMm: 0, wMm: 60, hMm: 60 } },
      { ...newItem('b', 'asset-b'), rect: { xMm: 70, yMm: 0, wMm: 60, hMm: 60 } },
    )
    project.selectedIds = ['a', 'b']
    let wrapper = mountBar(pinia)
    expect(wrapper.find('.selection').text()).toBe('已选 2 张')

    project.selectedIds = []
    wrapper = mountBar(pinia)
    expect(wrapper.find('.selection').text()).toBe('2 张 · 297×210mm')
  })

  it('保存状态与项目名', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const project = useProjectStore()
    const wrapper = mountBar(pinia)
    expect(wrapper.find('.save-state').text()).toContain('已保存')
    expect(wrapper.find('.project-name').text()).toBe('未命名项目')

    project.dirty = true
    currentProjectPath.value = '/home/u/我的排版.imglayout'
    await nextTick()
    expect(wrapper.find('.save-state').text()).toContain('未保存')
    expect(wrapper.find('.save-state').classes()).toContain('dirty')
    expect(wrapper.find('.project-name').text()).toBe('我的排版.imglayout')
    expect(wrapper.find('.project-name').attributes('title')).toBe('/home/u/我的排版.imglayout')
  })
})
