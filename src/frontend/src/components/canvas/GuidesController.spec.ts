import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { GuidesController } from './GuidesController'
import { useProjectStore } from '../../stores/project'
import type { Guide } from '../../types/layout'
import type { useCanvasView } from '../../composables/useCanvasView'

// 1:1 视口：屏幕像素 == 毫米（bleed 0），原点 (0,0)
function fakeView() {
  return {
    pxPerMm: ref(1),
    originX: ref(0),
    originY: ref(0),
    screenX: (mm: number, bleed: number) => mm + bleed,
    screenY: (mm: number, bleed: number) => mm + bleed,
    mmX: (px: number, bleed: number) => px - bleed,
    mmY: (px: number, bleed: number) => px - bleed,
  } as unknown as ReturnType<typeof useCanvasView>
}

function pointer(type: string, x: number, y: number): PointerEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  }) as unknown as PointerEvent
}

function makeStage(): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: 700, configurable: true })
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 700, height: 500, right: 700, bottom: 500, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  el.setPointerCapture = () => {}
  return el
}

describe('GuidesController（参考线交互）', () => {
  let pinia: Pinia
  let project: ReturnType<typeof useProjectStore>
  let stage: HTMLElement
  let ctl: GuidesController
  const onEdit = vi.fn()

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    project = useProjectStore()
    project.doc.mode = 'free'
    stage = makeStage()
    ctl = new GuidesController({ stage, view: fakeView(), redraw: () => {}, onEdit })
    ctl.attach()
    onEdit.mockClear()
  })

  function guides(): Guide[] {
    return project.doc.guides ?? []
  }

  it('从左标尺带拖出竖直参考线，松开落定并选中', () => {
    stage.dispatchEvent(pointer('pointerdown', 5, 250))
    expect(ctl.draft).toMatchObject({ axis: 'x', posMm: 5 })
    stage.dispatchEvent(pointer('pointermove', 120, 250))
    expect(ctl.draft?.posMm).toBe(120)
    stage.dispatchEvent(pointer('pointerup', 120, 250))
    expect(guides()).toHaveLength(1)
    expect(guides()[0].axis).toBe('x')
    expect(guides()[0].posMm).toBe(120)
    expect(project.selectedGuideIds).toEqual([guides()[0].id])
  })

  it('从底标尺带拖出水平参考线', () => {
    stage.dispatchEvent(pointer('pointerdown', 300, 495))
    expect(ctl.draft?.axis).toBe('y')
    stage.dispatchEvent(pointer('pointermove', 300, 300))
    stage.dispatchEvent(pointer('pointerup', 300, 300))
    expect(guides()).toHaveLength(1)
    expect(guides()[0].axis).toBe('y')
    expect(guides()[0].posMm).toBe(300)
  })

  it('误拖（松开仍在标尺带内）不创建', () => {
    stage.dispatchEvent(pointer('pointerdown', 5, 250))
    stage.dispatchEvent(pointer('pointerup', 5, 250))
    expect(guides()).toHaveLength(0)
  })

  it('点选参考线并拖回标尺带删除', () => {
    project.doc.guides = [{ id: 'g1', axis: 'x', posMm: 100 }]
    stage.dispatchEvent(pointer('pointerdown', 100, 250))
    expect(project.selectedGuideIds).toEqual(['g1'])
    stage.dispatchEvent(pointer('pointermove', 10, 250))
    expect(guides()[0].posMm).toBe(10)
    stage.dispatchEvent(pointer('pointerup', 10, 250))
    expect(guides()).toHaveLength(0)
  })

  it('锁定参考线：可选中但不可拖动', () => {
    project.doc.guides = [{ id: 'g1', axis: 'x', posMm: 100, locked: true }]
    stage.dispatchEvent(pointer('pointerdown', 100, 250))
    expect(project.selectedGuideIds).toEqual(['g1'])
    stage.dispatchEvent(pointer('pointermove', 150, 250))
    stage.dispatchEvent(pointer('pointerup', 150, 250))
    expect(guides()[0].posMm).toBe(100)
  })

  it('双击参考线触发精确编辑回调', () => {
    project.doc.guides = [{ id: 'g1', axis: 'x', posMm: 100 }]
    stage.dispatchEvent(pointer('dblclick', 100, 250))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit.mock.calls[0][0]).toMatchObject({ id: 'g1', axis: 'x', posMm: 100 })
  })

  it('Shift 点选多选参考线', () => {
    project.doc.guides = [
      { id: 'g1', axis: 'x', posMm: 100 },
      { id: 'g2', axis: 'y', posMm: 200 },
    ]
    stage.dispatchEvent(pointer('pointerdown', 100, 250))
    expect(project.selectedGuideIds).toEqual(['g1'])
    stage.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 300,
        clientY: 200,
        button: 0,
        shiftKey: true,
      }) as unknown as PointerEvent,
    )
    expect(project.selectedGuideIds).toEqual(['g1', 'g2'])
  })
})
