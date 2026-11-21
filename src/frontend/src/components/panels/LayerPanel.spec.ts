import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Slider from 'primevue/slider'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { newItem, type AssetEntry } from '../../types/layout'
import { useAssetsStore } from '../../stores/assets'
import { useProjectStore } from '../../stores/project'
import LayerPanel from './LayerPanel.vue'

// jsdom 无 Tauri 运行时
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `asset://localhost/${p}`,
}))

function entry(assetId: string): AssetEntry {
  return { assetId, path: `/photos/${assetId}.jpg`, thumbPath: `/thumbs/${assetId}.jpg`, widthPx: 100, heightPx: 100 }
}

function mountPanel(pinia: Pinia) {
  return mount(LayerPanel, {
    global: {
      plugins: [[PrimeVue, { theme: { preset: Aura } }], pinia],
      components: { Button, InputText, Slider },
    },
  })
}

describe('LayerPanel（PS 式图层面板）', () => {
  let pinia: Pinia
  let project: ReturnType<typeof useProjectStore>
  let assets: ReturnType<typeof useAssetsStore>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    project = useProjectStore()
    assets = useAssetsStore()
    assets.entries.set('asset-a', entry('asset-a'))
    assets.entries.set('asset-b', entry('asset-b'))
    project.doc.items.push({ ...newItem('a', 'asset-a'), name: '背景' })
    project.doc.items.push({ ...newItem('b', 'asset-b') })
  })

  it('顶层在前：第一行是 items 末尾的图层', () => {
    const wrapper = mountPanel(pinia)
    const firstName = wrapper.find('.layer-row .name')
    expect(firstName.exists()).toBe(true)
    // b 在数组末尾 = 最顶层；未命名时回退文件名
    expect(firstName.text()).toBe('asset-b.jpg')
    expect(wrapper.findAll('.layer-row')).toHaveLength(2)
  })

  it('眼睛按钮切换可见性并给隐藏行加样式', async () => {
    const wrapper = mountPanel(pinia)
    const eye = wrapper.findAll('.layer-row')[0].find('.eye')
    await eye.trigger('click')
    expect(project.doc.items[1].visible).toBe(false)
    expect(wrapper.findAll('.layer-row')[0].classes()).toContain('hidden')
  })

  it('锁定按钮切换 locked 并支持撤销', async () => {
    const wrapper = mountPanel(pinia)
    const lock = wrapper.findAll('.layer-row')[1].find('.lock')
    await lock.trigger('click')
    expect(project.doc.items[0].locked).toBe(true)
    project.undo()
    expect(project.doc.items[0].locked).toBe(false)
  })

  it('双击名称进入编辑，Enter 提交新名', async () => {
    const wrapper = mountPanel(pinia)
    await wrapper.findAll('.layer-row .name')[0].trigger('dblclick')
    const input = wrapper.find('input.name-input')
    expect(input.exists()).toBe(true)
    await input.setValue('顶层 1')
    await input.trigger('keydown.enter')
    expect(project.doc.items[1].name).toBe('顶层 1')
    expect(wrapper.find('.name').exists()).toBe(true)
  })

  it('拖拽排序：拖到下方 drop 后调 moveItem', async () => {
    const wrapper = mountPanel(pinia)
    const rows = wrapper.findAll('.layer-row')
    await rows[0].trigger('dragstart') // 拖最顶层 b
    await rows[1].trigger('dragover', { clientY: 10 }) // jsdom rect 全 0 → 视为下半 → pos=2
    await rows[1].trigger('drop')
    expect(project.doc.items.map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('选中图层显示底部不透明度与复制/删除按钮', async () => {
    const wrapper = mountPanel(pinia)
    expect(wrapper.find('.layer-footer').exists()).toBe(false)
    await wrapper.findAll('.layer-row')[0].trigger('click')
    const footer = wrapper.find('.layer-footer')
    expect(footer.exists()).toBe(true)
    expect(footer.text()).toContain('不透明度：100%')
    await footer.findAll('button')[0].trigger('click') // 复制图层
    expect(project.doc.items).toHaveLength(3)
    await footer.findAll('button')[1].trigger('click') // 删除图层（选中的是副本）
    expect(project.doc.items).toHaveLength(2)
  })
})
