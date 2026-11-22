import { defineStore } from 'pinia'
import {
  defaultGrid,
  defaultMasonry,
  emptyDoc,
  newItem,
  type AssetEntry,
  type CanvasSpec,
  type FillMode,
  type GridConfig,
  type LayoutDoc,
  type LayoutMode,
  type MasonryConfig,
  type PhotoItem,
  type RectMm,
} from '../types/layout'
import { layoutGrid } from '../lib/layout/grid'
import { layoutMasonry, type MasonryInput } from '../lib/layout/masonry'
import {
  alignRect,
  distributeRects,
  type AlignOp,
} from '../lib/layout/align'
import { useAssetsStore } from './assets'

const HISTORY_LIMIT = 50

export function computeRects(
  doc: LayoutDoc,
  assetSizes: Map<string, [number, number]>,
): (RectMm | null)[] {
  if (doc.mode === 'grid' && doc.grid) {
    return layoutGrid(doc.canvas, doc.grid, doc.items)
  }
  if (doc.mode === 'masonry' && doc.masonry) {
    const inputs: MasonryInput[] = []
    for (const item of doc.items) {
      const size = assetSizes.get(item.assetId)
      if (!size) return []
      inputs.push({ item, size })
    }
    return layoutMasonry(doc.canvas, doc.masonry, inputs)
  }
  return doc.items.map((i) => i.rect)
}

export function fillOf(doc: LayoutDoc): FillMode {
  return doc.mode === 'grid' && doc.grid ? doc.grid.fill : 'cover'
}

export const useProjectStore = defineStore('project', {
  state: () => ({
    doc: emptyDoc(),
    selectedIds: [] as string[],
    undoStack: [] as string[],
    redoStack: [] as string[],
  }),
  getters: {
    rects(state): (RectMm | null)[] {
      const assets = useAssetsStore()
      const sizes = new Map<string, [number, number]>()
      for (const item of state.doc.items) {
        const entry = assets.entries.get(item.assetId)
        if (entry) sizes.set(item.assetId, [entry.widthPx, entry.heightPx])
      }
      return computeRects(state.doc, sizes)
    },
    /** 全部选中项（按 doc.items 顺序）；selectedIds 里已删除的 id 自动被过滤 */
    selectedItems(state): PhotoItem[] {
      const set = new Set(state.selectedIds)
      return state.doc.items.filter((i) => set.has(i.id))
    },
    /** 主选中项 = 选中列表最后一位（最后点选/最新加入者） */
    selectedItem(): PhotoItem | null {
      const items = this.selectedItems
      return items.length ? items[items.length - 1] : null
    },
  },
  actions: {
    snapshot() {
      this.undoStack.push(JSON.stringify(this.doc))
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift()
      this.redoStack = []
    },
    undo() {
      const prev = this.undoStack.pop()
      if (prev == null) return
      this.redoStack.push(JSON.stringify(this.doc))
      this.doc = JSON.parse(prev)
      this.pruneSelection()
    },
    redo() {
      const next = this.redoStack.pop()
      if (next == null) return
      this.undoStack.push(JSON.stringify(this.doc))
      this.doc = JSON.parse(next)
      this.pruneSelection()
    },
    /** 清掉 selectedIds 中已不在文档里的 id（undo/redo/删除后调用） */
    pruneSelection() {
      const alive = new Set(this.doc.items.map((i) => i.id))
      this.selectedIds = this.selectedIds.filter((id) => alive.has(id))
    },
    select(id: string | null) {
      this.selectedIds = id ? [id] : []
    },
    toggleSelect(id: string) {
      const idx = this.selectedIds.indexOf(id)
      if (idx >= 0) this.selectedIds.splice(idx, 1)
      else this.selectedIds.push(id)
    },
    clearSelection() {
      this.selectedIds = []
    },
    setMode(mode: LayoutMode) {
      if (this.doc.mode === mode) return
      this.snapshot()
      this.doc.mode = mode
      if (mode === 'grid' && !this.doc.grid) this.doc.grid = defaultGrid()
      if (mode === 'masonry' && !this.doc.masonry) this.doc.masonry = defaultMasonry()
    },
    updateCanvas(patch: Partial<CanvasSpec>, recordHistory = true) {
      if (recordHistory) this.snapshot()
      Object.assign(this.doc.canvas, patch)
    },
    updateGrid(patch: Partial<GridConfig>, recordHistory = true) {
      if (!this.doc.grid) return
      if (recordHistory) this.snapshot()
      Object.assign(this.doc.grid, patch)
    },
    updateMasonry(patch: Partial<MasonryConfig>, recordHistory = true) {
      if (!this.doc.masonry) return
      if (recordHistory) this.snapshot()
      Object.assign(this.doc.masonry, patch)
    },
    addAssetsAsItems(entries: AssetEntry[]) {
      if (entries.length === 0) return
      this.snapshot()
      let cascade = this.doc.items.length % 6
      const added: string[] = []
      for (const entry of entries) {
        const item = newItem(crypto.randomUUID(), entry.assetId)
        if (this.doc.mode === 'free') {
          item.rect = { xMm: 12 + cascade * 8, yMm: 12 + cascade * 8, wMm: 60, hMm: 60 }
          cascade++
        }
        this.doc.items.push(item)
        added.push(item.id)
      }
      this.selectedIds = added
    },
    removeItem(id: string) {
      this.removeItems([id])
    },
    removeItems(ids: string[]) {
      const dead = new Set(ids)
      const targets = this.doc.items.filter((i) => dead.has(i.id))
      if (targets.length === 0) return
      this.snapshot()
      // 组合连带删除：删除成员时同组其余成员一并删除
      const groupIds = new Set(
        targets.map((i) => i.groupId).filter((g): g is string => g != null),
      )
      this.doc.items = this.doc.items.filter(
        (i) => !dead.has(i.id) && (i.groupId == null || !groupIds.has(i.groupId)),
      )
      this.doc.groups = (this.doc.groups ?? []).filter((g) => !groupIds.has(g.id))
      this.pruneSelection()
    },
    updateItem(id: string, patch: Partial<PhotoItem>) {
      const target = this.doc.items.find((i) => i.id === id)
      if (target) Object.assign(target, patch)
    },
    updateItemRect(id: string, rect: RectMm) {
      const target = this.doc.items.find((i) => i.id === id)
      if (target) target.rect = rect
    },
    reorder(id: string, direction: 1 | -1) {
      const idx = this.doc.items.findIndex((i) => i.id === id)
      const to = idx + direction
      if (idx < 0 || to < 0 || to >= this.doc.items.length) return
      this.snapshot()
      const [moved] = this.doc.items.splice(idx, 1)
      this.doc.items.splice(to, 0, moved)
    },
    moveItem(id: string, toIndex: number) {
      const from = this.doc.items.findIndex((i) => i.id === id)
      if (from < 0) return
      const to = Math.max(0, Math.min(this.doc.items.length - 1, toIndex))
      if (from === to) return
      this.snapshot()
      const [moved] = this.doc.items.splice(from, 1)
      this.doc.items.splice(to, 0, moved)
    },
    duplicateItem(id: string) {
      this.duplicateItems([id])
    },
    duplicateItems(ids: string[]) {
      const copies: string[] = []
      ids.forEach((id, n) => {
        const idx = this.doc.items.findIndex((i) => i.id === id)
        if (idx < 0) return
        if (copies.length === 0) this.snapshot()
        const copy: PhotoItem = JSON.parse(JSON.stringify(this.doc.items[idx]))
        copy.id = crypto.randomUUID()
        copy.name = copy.name ? `${copy.name} 副本` : null
        copy.groupId = null
        if (this.doc.mode === 'free') {
          const off = 8 * (n + 1)
          copy.rect = { ...copy.rect, xMm: copy.rect.xMm + off, yMm: copy.rect.yMm + off }
        }
        this.doc.items.splice(idx + 1, 0, copy)
        copies.push(copy.id)
      })
      if (copies.length) this.selectedIds = copies
    },
    groupSelection() {
      const members = this.selectedItems.filter((i) => !i.locked && i.groupId == null)
      if (members.length < 2) return
      this.snapshot()
      const gid = crypto.randomUUID()
      this.doc.groups = [...(this.doc.groups ?? []), { id: gid, name: null }]
      for (const m of members) m.groupId = gid
    },
    ungroupSelection() {
      const groups = new Set(
        this.selectedItems.map((i) => i.groupId).filter((g): g is string => g != null),
      )
      if (groups.size === 0) return
      this.snapshot()
      for (const item of this.doc.items) {
        if (item.groupId != null && groups.has(item.groupId)) item.groupId = null
      }
      this.doc.groups = (this.doc.groups ?? []).filter((g) => !groups.has(g.id))
    },
    /**
     * 对齐/分布：仅自由布局；refRect 由调用方按 PS 口径给出
     * （多选=选区包围盒，单选/强制=画布）。锁定项不动。
     */
    alignSelection(mode: AlignOp, refRect: RectMm) {
      if (this.doc.mode !== 'free') return
      const targets = this.selectedItems.filter((i) => !i.locked)
      if (targets.length === 0) return
      const isDistribute = mode === 'distribute-h' || mode === 'distribute-v'
      if (isDistribute && targets.length < 3) return
      this.snapshot()
      if (mode === 'distribute-h' || mode === 'distribute-v') {
        const next = distributeRects(targets, mode === 'distribute-h' ? 'h' : 'v', refRect)
        for (const t of targets) {
          const rect = next.get(t.id)
          if (rect) t.rect = rect
        }
      } else {
        for (const t of targets) {
          t.rect = alignRect(t.rect, mode, refRect)
        }
      }
    },
    replaceDoc(doc: LayoutDoc) {
      this.doc = doc
      this.selectedIds = []
      this.undoStack = []
      this.redoStack = []
    },
  },
})
