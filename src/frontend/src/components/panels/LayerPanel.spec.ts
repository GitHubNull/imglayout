import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import Slider from 'primevue/slider'
import ToggleButton from 'primevue/togglebutton'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { newItem, type AssetEntry } from '../../types/layout'
import { useAssetsStore } from '../../stores/assets'
import { useProjectStore } from '../../stores/project'
import { useSettingsStore } from '../../stores/settings'
import LayerPanel from './LayerPanel.vue'

// jsdom 无 Tauri 运行时
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `asset://localhost/${p}`,
}))

function entry(assetId: string): AssetEntry {
  return { assetId, path: `/photos/${assetId}.jpg`, thumbPath: `/thumbs/${assetId}.jpg`, widthPx: 100, heightPx: 100 }
}

function mountPanel(pinia: Pinia, errorHandler?: (err: unknown) => void) {
  return mount(LayerPanel, {
    global: {
      plugins: [[PrimeVue, { theme: { preset: Aura } }], pinia],
      components: { Button, IconField, InputIcon, InputText, SelectButton, Slider, ToggleButton },
      config: errorHandler ? { errorHandler } : {},
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

  it('搜索框按名称过滤，过滤态禁止拖拽', async () => {
    const wrapper = mountPanel(pinia)
    const input = wrapper.find('.layer-search input')
    expect(input.exists()).toBe(true)
    await input.setValue('背景')
    expect(wrapper.findAll('.layer-row')).toHaveLength(1)
    expect(wrapper.find('.layer-row .name').text()).toBe('背景')
    expect(wrapper.find('.layer-row').attributes('draggable')).toBe('false')
    await input.setValue('不存在的名字')
    expect(wrapper.findAll('.layer-row')).toHaveLength(0)
    expect(wrapper.find('.empty').text()).toBe('无匹配图层')
  })

  it('Ctrl+点击多选，再次 Ctrl+点击取消选中', async () => {
    const wrapper = mountPanel(pinia)
    const rows = wrapper.findAll('.layer-row')
    await rows[0].trigger('click', { ctrlKey: true })
    await rows[1].trigger('click', { ctrlKey: true })
    expect(project.selectedIds).toHaveLength(2)
    await rows[0].trigger('click', { ctrlKey: true })
    expect(project.selectedIds).toHaveLength(1)
  })

  it('不透明度滑杆：一次拖动合并为一步撤销，撤销恢复原值（快照先于变更）', async () => {
    const wrapper = mountPanel(pinia)
    project.select('a')
    await nextTick()
    const before = project.doc.items[0].opacity
    const stackBefore = project.undoStack.length

    const slider = wrapper.findComponent(Slider)
    expect(slider.exists()).toBe(true)
    // 模拟一次拖动手势：连续多次变更后 slideend
    await slider.vm.$emit('update:model-value', 40)
    await slider.vm.$emit('update:model-value', 70)
    await slider.vm.$emit('slideend')

    expect(project.doc.items[0].opacity).toBeCloseTo(0.7)
    expect(project.undoStack.length).toBe(stackBefore + 1)
    project.undo()
    expect(project.doc.items[0].opacity).toBe(before)
  })

  it('默认态显示序号列：顶部图层序号最大，行序等于 items 倒序', async () => {
    assets.entries.set('asset-c', entry('asset-c'))
    project.doc.items.push({ ...newItem('c', 'asset-c') })
    const wrapper = mountPanel(pinia)
    const indexes = wrapper.findAll('.layer-index').map((el) => el.text())
    expect(indexes).toEqual(['3', '2', '1'])
    expect(wrapper.findAll('.layer-row .name').map((el) => el.text())).toEqual([
      'asset-c.jpg',
      'asset-b.jpg',
      '背景',
    ])
  })

  it('关闭 layerIndexVisible 后行内无序号列', async () => {
    const wrapper = mountPanel(pinia)
    expect(wrapper.findAll('.layer-index')).toHaveLength(2)
    useSettingsStore(pinia).layerIndexVisible = false
    await nextTick()
    expect(wrapper.findAll('.layer-index')).toHaveLength(0)
  })

  it('按文件名排序：升序/降序正确，同名按序号↓兜底，且不改 items 堆叠次序', async () => {
    assets.entries.set('asset-c', entry('asset-c'))
    assets.entries.set('asset-d', entry('asset-d'))
    project.doc.items.push({ ...newItem('c', 'asset-c'), name: '背景' })
    project.doc.items.push({ ...newItem('d', 'asset-d') })
    const wrapper = mountPanel(pinia)
    const sort = wrapper.findComponent(SelectButton)
    const idsBefore = project.doc.items.map((i) => i.id)

    await sort.vm.$emit('update:modelValue', 'name-asc')
    // zh-Hans-CN 排序：汉字按拼音在拉丁字母之前；同名「背景」按序号↓兜底（c 序号大在前）
    expect(wrapper.findAll('.layer-row .name').map((el) => el.text())).toEqual([
      '背景',
      '背景',
      'asset-b.jpg',
      'asset-d.jpg',
    ])

    await sort.vm.$emit('update:modelValue', 'name-desc')
    expect(wrapper.findAll('.layer-row .name').map((el) => el.text())).toEqual([
      'asset-d.jpg',
      'asset-b.jpg',
      '背景',
      '背景',
    ])

    // 纯视图排序：items 数组本身不动
    expect(project.doc.items.map((i) => i.id)).toEqual(idsBefore)
  })

  it('非默认排序下禁止拖拽，切回序号↓恢复', async () => {
    const wrapper = mountPanel(pinia)
    expect(wrapper.find('.layer-row').attributes('draggable')).toBe('true')
    await wrapper.findComponent(SelectButton).vm.$emit('update:modelValue', 'name-asc')
    expect(wrapper.find('.layer-row').attributes('draggable')).toBe('false')
    await wrapper.findComponent(SelectButton).vm.$emit('update:modelValue', 'index-desc')
    expect(wrapper.find('.layer-row').attributes('draggable')).toBe('true')
  })

  it('排序与搜索叠加：过滤结果仍按当前排序呈现', async () => {
    assets.entries.set('asset-c', entry('asset-c'))
    project.doc.items.push({ ...newItem('c', 'asset-c'), name: '背景' })
    const wrapper = mountPanel(pinia)
    await wrapper.findComponent(SelectButton).vm.$emit('update:modelValue', 'name-asc')
    await wrapper.find('.layer-search input').setValue('背景')
    const names = wrapper.findAll('.layer-row .name').map((el) => el.text())
    expect(names).toEqual(['背景', '背景'])
    // 同名兜底：c（序号 3）在 a（序号 1）前
    const indexes = wrapper.findAll('.layer-index').map((el) => el.text())
    expect(indexes).toEqual(['3', '1'])
  })

  it('点击当前已选排序项不会清空排序，图层行保持渲染', async () => {
    const errors: unknown[] = []
    const wrapper = mountPanel(pinia, (err) => errors.push(err))
    const options = wrapper.findAll('.sort-bar button.p-togglebutton')
    expect(options).toHaveLength(4)
    expect(options[0].attributes('aria-pressed')).toBe('true')

    // SelectButton 默认 allowEmpty=true，真实点击已选中项会写 null；此路径无法用 $emit 覆盖
    await options[0].trigger('click')
    await nextTick()

    expect(errors).toEqual([])
    expect(wrapper.findAll('.layer-row')).toHaveLength(2)
    expect(wrapper.findAll('.sort-bar button.p-togglebutton')[0].attributes('aria-pressed')).toBe('true')
  })
})
