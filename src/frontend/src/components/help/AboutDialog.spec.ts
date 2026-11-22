import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import AboutDialog from './AboutDialog.vue'
import { APP_CHANGELOG, APP_VERSION } from 'virtual:app-info'

const wrappers: ReturnType<typeof mount>[] = []

afterEach(() => {
  // Dialog 内容 Teleport 到 body，必须卸载干净，否则会串扰后续用例的 DOM 查询
  for (const w of wrappers.splice(0)) w.unmount()
})

function mountDialog() {
  const wrapper = mount(AboutDialog, {
    props: { modelValue: true },
    global: {
      plugins: [[PrimeVue, { theme: { preset: Aura } }]],
      components: { Dialog, Button },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('AboutDialog（关于对话框）', () => {
  it('展示版本号、作者与 MIT 协议', async () => {
    mountDialog()
    await nextTick()
    const text = document.body.textContent ?? ''
    expect(text).toContain(`版本 v${APP_VERSION}`)
    expect(text).toContain('GitHubNull')
    expect(text).toContain('MIT License')
    expect(text).toContain('Copyright (c) 2026 GitHubNull')
  })

  it('更新历史以 Markdown 渲染（标题/列表），不再是原始文本', async () => {
    mountDialog()
    await nextTick()
    const text = document.body.textContent ?? ''
    expect(text).toContain('[Unreleased]')
    expect(text).toContain('[1.0.0]')
    expect(APP_CHANGELOG).toContain('[1.0.0]')
    // 渲染成真正的标题与列表节点，而非 pre 原文
    expect(document.body.querySelector('.about-changelog h2')?.textContent).toBe('[Unreleased]')
    expect(document.body.querySelectorAll('.about-changelog li').length).toBeGreaterThan(0)
  })

  it('点关闭按钮后请求关闭弹窗', async () => {
    const wrapper = mountDialog()
    await nextTick()
    const closeBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('关闭'),
    )
    expect(closeBtn).toBeTruthy()
    closeBtn!.click()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })
})
