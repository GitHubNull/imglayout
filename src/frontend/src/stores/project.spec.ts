import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { newItem } from '../types/layout'
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
    expect(store.selectedId).toBe(copy.id)
    // 自由模式：副本位置偏移 8mm
    expect(copy.rect.xMm).toBe(8)
    expect(copy.rect.yMm).toBe(8)
  })

  it('图层级字段默认值完整', () => {
    const store = useProjectStore()
    seed(store, ['a'])
    const item = store.doc.items[0]
    expect(item.visible).toBe(true)
    expect(item.opacity).toBe(1)
    expect(item.locked).toBe(false)
    expect(item.name).toBeNull()
  })
})
