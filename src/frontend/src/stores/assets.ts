import { defineStore } from 'pinia'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { AssetEntry } from '../types/layout'

let onImageLoaded: (() => void) | null = null

export function setAssetImageListener(fn: () => void) {
  onImageLoaded = fn
}

export const useAssetsStore = defineStore('assets', {
  state: () => ({
    entries: new Map<string, AssetEntry>(),
    images: new Map<string, HTMLImageElement>(),
  }),
  actions: {
    addAll(list: AssetEntry[]) {
      for (const e of list) {
        this.entries.set(e.assetId, e)
        this.loadImage(e.assetId)
      }
    },
    replaceAll(list: AssetEntry[]) {
      this.entries.clear()
      this.images.clear()
      this.addAll(list)
    },
    remove(assetId: string) {
      this.entries.delete(assetId)
      this.images.delete(assetId)
    },
    loadImage(assetId: string) {
      if (this.images.has(assetId)) return
      const entry = this.entries.get(assetId)
      if (!entry) return
      const img = new Image()
      img.onload = () => onImageLoaded?.()
      img.src = convertFileSrc(entry.thumbPath)
      this.images.set(assetId, img)
    },
    image(assetId: string): HTMLImageElement | null {
      return this.images.get(assetId) ?? null
    },
    thumbUrl(assetId: string): string | null {
      const entry = this.entries.get(assetId)
      return entry ? convertFileSrc(entry.thumbPath) : null
    },
    asList(): AssetEntry[] {
      return [...this.entries.values()]
    },
  },
})
