/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 单一版本来源：仓库根 package.json（CI 发版校验 tag 与之一致）
const appVersion = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')) as {
    version: string
  }
).version

// 更新历史在仓库根 CHANGELOG.md，构建期整体注入，避免前端跨工程目录 import
const changelog = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf-8')

// virtual 模块统一导出构建期常量（define 在 vitest 下不生效，virtual 模块走同一插件管线则两端一致）
const virtualAppInfo = {
  name: 'virtual-app-info',
  resolveId(id: string) {
    return id === 'virtual:app-info' ? '\0virtual:app-info' : null
  },
  load(id: string) {
    if (id !== '\0virtual:app-info') return null
    return `export const APP_VERSION = ${JSON.stringify(appVersion)}\nexport const APP_CHANGELOG = ${JSON.stringify(changelog)}\n`
  },
}

export default defineConfig({
  plugins: [vue(), virtualAppInfo],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
  },
})
