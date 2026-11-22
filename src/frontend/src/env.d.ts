// virtual:app-info 模块类型声明（vite 插件在构建期注入，见 vite.config.ts）
declare module 'virtual:app-info' {
  export const APP_VERSION: string
  export const APP_CHANGELOG: string
}
