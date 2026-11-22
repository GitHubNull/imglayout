// 项目文件操作：保存 / 另存为 / 打开。
// .imglayout = zip 单文件包（layout.yaml + 嵌入原图）；.json = 旧版纯数据文件，兼容打开/另存。
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { ref } from 'vue'
import { useAssetsStore } from '../stores/assets'
import { useProjectStore } from '../stores/project'
import type { AssetEntry, LayoutDoc } from '../types/layout'

interface ProjectFilePayload {
  doc: LayoutDoc
  assets: AssetEntry[]
  /** 包内未找到原图的 asset（仅 .imglayout 返回） */
  missingAssetIds?: string[]
}

export function useProjectFile() {
  const project = useProjectStore()
  const assets = useAssetsStore()
  /** 当前项目文件路径；null = 从未保存（Ctrl+S 走另存为） */
  const currentPath = ref<string | null>(null)

  async function saveProject() {
    if (!currentPath.value) {
      await saveProjectAs()
      return
    }
    if (await writeTo(currentPath.value)) project.markClean()
  }

  async function saveProjectAs() {
    const path = await save({
      defaultPath: '未命名.imglayout',
      filters: [{ name: 'imgLayout 项目包', extensions: ['imglayout', 'json'] }],
    })
    if (!path) return
    if (await writeTo(path)) {
      currentPath.value = path
      project.markClean()
    }
  }

  /** @returns true=已保存；false=用户取消或失败已提示 */
  async function writeTo(path: string): Promise<boolean> {
    if (path.toLowerCase().endsWith('.json')) {
      try {
        await invoke('save_project', { path, doc: project.doc, assets: assets.asList() })
        return true
      } catch (err) {
        window.alert(`保存失败：${err}`)
        return false
      }
    }
    try {
      await invoke('save_project_package', {
        path,
        doc: project.doc,
        assets: assets.asList(),
        allowMissing: false,
      })
      return true
    } catch (err) {
      // 原图缺失：确认后跳过缺失继续保存
      if (window.confirm(`${String(err)}\n\n跳过缺失的照片并继续保存？（缺失照片在重新打开时显示「缺失」）`)) {
        try {
          await invoke('save_project_package', {
            path,
            doc: project.doc,
            assets: assets.asList(),
            allowMissing: true,
          })
          return true
        } catch (err2) {
          window.alert(`保存失败：${err2}`)
          return false
        }
      }
      return false
    }
  }

  async function openProject() {
    if (
      project.dirty &&
      !window.confirm('当前项目有未保存的修改，打开其他项目将丢弃这些修改。是否继续？')
    ) {
      return
    }
    const path = await open({
      filters: [{ name: 'imgLayout 项目', extensions: ['imglayout', 'json'] }],
    })
    if (typeof path !== 'string') return
    let file: ProjectFilePayload
    try {
      file = path.toLowerCase().endsWith('.json')
        ? await invoke<ProjectFilePayload>('load_project', { path })
        : await invoke<ProjectFilePayload>('load_project_package', { path })
    } catch (err) {
      window.alert(`打开项目失败：${err}`)
      return
    }
    assets.replaceAll(file.assets)
    project.replaceDoc(file.doc)
    currentPath.value = path
    if (file.missingAssetIds?.length) {
      window.alert(`项目包中缺少 ${file.missingAssetIds.length} 张照片的图像数据，对应图层已标记为「缺失」。`)
    }
  }

  return { currentPath, saveProject, saveProjectAs, openProject }
}
