import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { newItem, defaultMasonry } from '../types/layout'
import { useProjectStore } from './project'

function seed(store: ReturnType<typeof useProjectStore>, ids: string[]) {
  for (const id of ids) {
    store.doc.items.push({ ...newItem(id, `asset-${id}`) })
  }
}

describe('project store 图层管理', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('moveItem 移动到指定下标并支持撤销', () => {
    const store = useProjectStore()
    seed(store, ['a', 'b', 'c'])
    store.moveItem('a', 2)
    expect(store.doc.items.map((i) => i.id)).toEqual(['b', 'c', 'a'])
    store.undo()
    expect(store.doc.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('moveItem 下标越界时钳制', () => {
    const store = useProjectStore()
    seed(store, ['a', 'b', 'c'])
    store.moveItem('c', 99)
    expect(store.doc.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    store.moveItem('a', -5)
    expect(store.doc.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('切到 free 模式时零尺寸 rect 补齐为默认错位摆放', () => {
    const store = useProjectStore()
    seed(store, ['a', 'b'])
    expect(store.doc.items.every((i) => i.rect.wMm === 0)).toBe(true)
    store.setMode('free')
    for (const item of store.doc.items) {
      expect(item.rect.wMm).toBe(60)
      expect(item.rect.hMm).toBe(60)
    }
    // 已有尺寸的项不被覆盖
    store.setMode('grid')
    store.doc.items[0].rect = { xMm: 5, yMm: 5, wMm: 30, hMm: 30 }
    store.doc.items[1].rect = { xMm: 0, yMm: 0, wMm: 0, hMm: 0 }
    store.setMode('free')
    expect(store.doc.items[0].rect.wMm).toBe(30)
    expect(store.doc.items[1].rect.wMm).toBe(60)
  })

  it('duplicateItem 复制插入原层上方、生成新 id 并选中', () => {
    const store = useProjectStore()
    store.doc.mode = 'free'
    seed(store, ['a', 'b'])
    store.updateItem('a', { name: '背景' })
    store.duplicateItem('a')
    expect(store.doc.items).toHaveLength(3)
    const copy = store.doc.items[1]
    expect(copy.id).not.toBe('a')
    expect(copy.name).toBe('背景 副本')
    expect(copy.assetId).toBe('asset-a')
    expect(store.selectedIds).toEqual([copy.id])
    // 自由模式：副本位置偏移 8mm
    expect(copy.rect.xMm).toBe(8)
    expect(copy.rect.yMm).toBe(8)
  })

  it('多选：select/toggleSelect/primary 语义', () => {
    const store = useProjectStore()
    seed(store, ['a', 'b', 'c'])
    store.select('a')
    store.toggleSelect('c')
    expect(store.selectedIds).toEqual(['a', 'c'])
    expect(store.selectedItem?.id).toBe('c')
    store.toggleSelect('c')
    expect(store.selectedIds).toEqual(['a'])
    store.clearSelection()
    expect(store.selectedIds).toEqual([])
  })

  it('removeItems 批量删除并清理选中', () => {
    const store = useProjectStore()
    seed(store, ['a', 'b', 'c'])
    store.select('b')
    store.toggleSelect('c')
    store.removeItems(['b', 'c'])
    expect(store.doc.items.map((i) => i.id)).toEqual(['a'])
    expect(store.selectedIds).toEqual([])
    store.undo()
    expect(store.doc.items).toHaveLength(3)
  })

  it('图层级字段默认值完整', () => {
    const store = useProjectStore()
    seed(store, ['a'])
    const item = store.doc.items[0]
    expect(item.visible).toBe(true)
    expect(item.opacity).toBe(1)
    expect(item.locked).toBe(false)
    expect(item.name).toBeNull()
    expect(item.groupId).toBeNull()
  })
})

describe('project store 组合', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('groupSelection 组合未锁定选中项，ungroupSelection 解散', () => {
    const store = useProjectStore()
    seed(store, ['a', 'b', 'c'])
    store.select('a')
    store.toggleSelect('b')
    store.groupSelection()
    const gid = store.doc.items[0].groupId
    expect(gid).not.toBeNull()
    expect(store.doc.items[1].groupId).toBe(gid)
    expect(store.doc.items[2].groupId).toBeNull()
    expect(store.doc.groups).toHaveLength(1)
    store.ungroupSelection()
    expect(store.doc.items.every((i) => i.groupId == null)).toBe(true)
    expect(store.doc.groups).toHaveLength(0)
  })

  it('锁定项不参与组合，单项不组合', () => {
    const store = useProjectStore()
    seed(store, ['a', 'b'])
    store.updateItem('b', { locked: true })
    store.select('a')
    store.toggleSelect('b')
    store.groupSelection()
    expect(store.doc.groups ?? []).toHaveLength(0)
  })

  it('删除组合成员连带删除全组', () => {
    const store = useProjectStore()
    seed(store, ['a', 'b', 'c'])
    store.select('a')
    store.toggleSelect('b')
    store.groupSelection()
    store.removeItem('a')
    expect(store.doc.items.map((i) => i.id)).toEqual(['c'])
    expect(store.doc.groups).toHaveLength(0)
  })
})

describe('project store 对齐/分布', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function seedFree(store: ReturnType<typeof useProjectStore>) {
    store.doc.mode = 'free'
    seed(store, ['a', 'b'])
    store.updateItemRect('a', { xMm: 10, yMm: 10, wMm: 20, hMm: 20 })
    store.updateItemRect('b', { xMm: 100, yMm: 80, wMm: 40, hMm: 10 })
  }

  it('单选对齐到画布：左对齐 + 一步撤销', () => {
    const store = useProjectStore()
    seedFree(store)
    store.select('b')
    const canvas = { xMm: 0, yMm: 0, wMm: 297, hMm: 210 }
    store.alignSelection('left', canvas)
    expect(store.doc.items[1].rect.xMm).toBe(0)
    expect(store.doc.items[1].rect.yMm).toBe(80)
    expect(store.doc.items[0].rect.xMm).toBe(10)
    store.undo()
    expect(store.doc.items[1].rect.xMm).toBe(100)
  })

  it('多选对齐到选区包围盒：水平居中', () => {
    const store = useProjectStore()
    seedFree(store)
    store.select('a')
    store.toggleSelect('b')
    // 包围盒 x:10..140 → 中心 75；b 宽 40 → x = 75 - 20 = 55
    const bounds = { xMm: 10, yMm: 10, wMm: 130, hMm: 80 }
    store.alignSelection('h-center', bounds)
    expect(store.doc.items[1].rect.xMm).toBe(55)
  })

  it('水平平均分布：首尾贴参照边缘、中间等间隙', () => {
    const store = useProjectStore()
    seedFree(store)
    store.doc.items.push({ ...newItem('d', 'asset-d') })
    store.updateItemRect('d', { xMm: 200, yMm: 0, wMm: 20, hMm: 20 })
    store.select('a')
    store.toggleSelect('b')
    store.toggleSelect('d')
    const ref = { xMm: 0, yMm: 0, wMm: 297, hMm: 210 }
    store.alignSelection('distribute-h', ref)
    const byId = Object.fromEntries(store.doc.items.map((i) => [i.id, i.rect]))
    expect(byId.a.xMm).toBe(0)
    expect(byId.d.xMm).toBeCloseTo(297 - 20)
    // 间隙 = (297 − 80) / 2 = 108.5
    expect(byId.b.xMm).toBeCloseTo(20 + 108.5)
  })

  it('非自由布局与锁定项不受对齐影响', () => {
    const store = useProjectStore()
    seedFree(store)
    store.doc.mode = 'grid'
    store.select('b')
    store.alignSelection('left', { xMm: 0, yMm: 0, wMm: 297, hMm: 210 })
    expect(store.doc.items[1].rect.xMm).toBe(100)
  })

  it('masonry 缺尺寸的 asset 只影响该张，其余照常排版', async () => {
    const { useAssetsStore } = await import('./assets')
    const assets = useAssetsStore()
    assets.entries.set('asset-a', { assetId: 'asset-a', path: '/a.jpg', thumbPath: '', widthPx: 100, heightPx: 100 })
    assets.entries.set('asset-c', { assetId: 'asset-c', path: '/c.jpg', thumbPath: '', widthPx: 100, heightPx: 50 })
    const store = useProjectStore()
    seed(store, ['a', 'b', 'c'])
    store.doc.mode = 'masonry'
    store.doc.masonry = defaultMasonry()
    const rects = store.rects
    expect(rects).toHaveLength(3)
    expect(rects[1]).toBeNull()
    expect(rects[0]).not.toBeNull()
    expect(rects[2]).not.toBeNull()
  })

  it('撤销后再次微调各自记快照（nudging 状态复位）', () => {
    const store = useProjectStore()
    seed(store, ['a'])
    store.doc.mode = 'free'
    store.doc.items[0].rect = { xMm: 0, yMm: 0, wMm: 10, hMm: 10 }
    store.select('a')
    store.nudgeSelection(1, 0)
    expect(store.undoStack).toHaveLength(1)
    store.undo()
    store.nudgeSelection(1, 0)
    // 若 nudging 未复位，第二次微调不会记快照，撤销会把两步一起回退
    expect(store.undoStack).toHaveLength(1)
    store.undo()
    expect(store.doc.items[0].rect.xMm).toBe(0)
  })
})
