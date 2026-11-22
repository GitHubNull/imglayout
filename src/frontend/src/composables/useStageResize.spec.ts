import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useCanvasView } from './useCanvasView'
import { useStageResize } from './useStageResize'

class MockResizeObserver {
  static instances: MockResizeObserver[] = []
  cb: ResizeObserverCallback
  disconnected = false

  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
    MockResizeObserver.instances.push(this)
  }

  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true
  }

  trigger() {
    this.cb([] as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver)
  }
}

function makeDiv(w: number, hh: number): HTMLDivElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { value: w, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: hh, configurable: true })
  return el
}

function resizeDiv(el: HTMLDivElement, w: number, hh: number) {
  Object.defineProperty(el, 'clientWidth', { value: w, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: hh, configurable: true })
}

interface HarnessExpose {
  fit: ReturnType<typeof vi.fn>
  redraw: ReturnType<typeof vi.fn>
  stageEl: Ref<HTMLDivElement>
}

function mountHarness(view: ReturnType<typeof useCanvasView>, div: HTMLDivElement) {
  const Harness = defineComponent({
    setup() {
      const stageEl = ref(div) as Ref<HTMLDivElement>
      const fit = vi.fn()
      const redraw = vi.fn()
      useStageResize(stageEl, view, fit, redraw).observe()
      return { fit, redraw, stageEl }
    },
    render() {
      return h('div')
    },
  })
  return mount(Harness)
}

describe('useStageResize', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    MockResizeObserver.instances = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('自动适配态：容器变化触发 fit', () => {
    const view = useCanvasView()
    const div = makeDiv(1000, 800)
    const wrapper = mountHarness(view, div)
    const expose = wrapper.vm as unknown as HarnessExpose
    expect(MockResizeObserver.instances.length).toBe(1)

    resizeDiv(div, 800, 600)
    MockResizeObserver.instances[0].trigger()
    expect(expose.fit).toHaveBeenCalledTimes(1)
    expect(expose.redraw).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('手动视图态：只重居中补偿，不 fit 且不退出状态机语义', () => {
    const view = useCanvasView()
    view.isAutoFit.value = false
    const div = makeDiv(1000, 800)
    const wrapper = mountHarness(view, div)
    const expose = wrapper.vm as unknown as HarnessExpose

    // 首触发仅建立基线
    MockResizeObserver.instances[0].trigger()
    expect(expose.fit).not.toHaveBeenCalled()
    const ox = view.originX.value

    // 窗口缩小 200×100：原点按差值一半补偿
    resizeDiv(div, 800, 700)
    MockResizeObserver.instances[0].trigger()
    expect(expose.fit).not.toHaveBeenCalled()
    expect(view.originX.value).toBeCloseTo(ox - 100, 6)
    expect(view.originY.value).toBeCloseTo(-50, 6)
    expect(view.isAutoFit.value).toBe(false)
    wrapper.unmount()
  })

  it('容器尺寸为 0 时不 fit 也不重绘', () => {
    const view = useCanvasView()
    const div = makeDiv(0, 0)
    const wrapper = mountHarness(view, div)
    const expose = wrapper.vm as unknown as HarnessExpose

    MockResizeObserver.instances[0].trigger()
    expect(expose.fit).not.toHaveBeenCalled()
    expect(expose.redraw).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('卸载时断开 ResizeObserver', () => {
    const view = useCanvasView()
    const wrapper = mountHarness(view, makeDiv(1000, 800))
    wrapper.unmount()
    expect(MockResizeObserver.instances[0].disconnected).toBe(true)
  })
})
