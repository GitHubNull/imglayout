import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import TutorialDialog from './TutorialDialog.vue'
import { TUTORIAL_CHAPTERS } from '../../lib/help/tutorials'

const wrappers: ReturnType<typeof mount>[] = []

afterEach(() => {
  // Dialog 内容 Teleport 到 body，必须卸载干净，否则会串扰后续用例的 DOM 查询
  for (const w of wrappers.splice(0)) w.unmount()
})

function mountDialog() {
  const wrapper = mount(TutorialDialog, {
    props: { modelValue: true },
    global: {
      plugins: [[PrimeVue, { theme: { preset: Aura } }]],
      components: { Dialog, Button },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

function navItems(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll('.tu-nav-item'))
}

describe('TutorialDialog（使用教程弹窗）', () => {
  it('章节数据完整：3 章、id 唯一且与 doc/user 文件名对应、每章有步骤', () => {
    expect(TUTORIAL_CHAPTERS).toHaveLength(3)
    expect(new Set(TUTORIAL_CHAPTERS.map((c) => c.id)).size).toBe(3)
    expect(TUTORIAL_CHAPTERS.map((c) => c.id)).toEqual(['quick-start', 'layers-layout', 'export-project'])
    for (const chapter of TUTORIAL_CHAPTERS) {
      expect(chapter.title.length).toBeGreaterThan(0)
      expect(chapter.summary.length).toBeGreaterThan(0)
      expect(chapter.steps.length).toBeGreaterThan(0)
      for (const step of chapter.steps) {
        expect(step.title.length).toBeGreaterThan(0)
        expect(step.body.length).toBeGreaterThan(0)
      }
    }
  })

  it('默认渲染第一章，章节导航数量正确', async () => {
    mountDialog()
    await nextTick()
    expect(navItems()).toHaveLength(3)
    expect(navItems()[0].classList.contains('active')).toBe(true)
    expect(document.body.textContent).toContain(TUTORIAL_CHAPTERS[0].summary)
  })

  it('点击章节导航切换内容', async () => {
    mountDialog()
    await nextTick()
    navItems()[1].click()
    await nextTick()
    expect(navItems()[1].classList.contains('active')).toBe(true)
    expect(document.body.textContent).toContain(TUTORIAL_CHAPTERS[1].summary)
    expect(document.body.textContent).toContain(TUTORIAL_CHAPTERS[1].steps[0].title)
  })

  it('上一章/下一章按钮切换章节且边界禁用', async () => {
    mountDialog()
    await nextTick()
    const buttons = () => Array.from(document.body.querySelectorAll('.tu-footer button'))
    const prev = () => buttons().find((b) => b.textContent?.includes('上一章')) as HTMLButtonElement
    const next = () => buttons().find((b) => b.textContent?.includes('下一章')) as HTMLButtonElement

    expect(prev().disabled).toBe(true)
    next().click()
    await nextTick()
    expect(navItems()[1].classList.contains('active')).toBe(true)
    expect(prev().disabled).toBe(false)

    next().click()
    await nextTick()
    expect(navItems()[2].classList.contains('active')).toBe(true)
    expect(next().disabled).toBe(true)

    prev().click()
    await nextTick()
    expect(navItems()[1].classList.contains('active')).toBe(true)
    expect(document.body.textContent).toContain('第 2 / 3 章')
  })
})
