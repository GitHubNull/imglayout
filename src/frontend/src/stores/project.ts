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
    selectedId: null as string | null,
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
    selectedItem(state): PhotoItem | null {
      return state.doc.items.find((i) => i.id === state.selectedId) ?? null
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
    },
    redo() {
      const next = this.redoStack.pop()
      if (next == null) return
      this.undoStack.push(JSON.stringify(this.doc))
      this.doc = JSON.parse(next)
    },
    select(id: string | null) {
      this.selectedId = id
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
      for (const entry of entries) {
        const item = newItem(crypto.randomUUID(), entry.assetId)
        if (this.doc.mode === 'free') {
          item.rect = { xMm: 12 + cascade * 8, yMm: 12 + cascade * 8, wMm: 60, hMm: 60 }
          cascade++
        }
        this.doc.items.push(item)
        this.selectedId = item.id
      }
    },
    removeItem(id: string) {
      const idx = this.doc.items.findIndex((i) => i.id === id)
      if (idx < 0) return
      this.snapshot()
      this.doc.items.splice(idx, 1)
      if (this.selectedId === id) this.selectedId = null
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
    replaceDoc(doc: LayoutDoc) {
      this.doc = doc
      this.selectedId = null
      this.undoStack = []
      this.redoStack = []
    },
  },
})
