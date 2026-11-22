import { describe, expect, it } from 'vitest'
import { interactionKind, interactionLabel, type InteractionKind } from './useInteractionStatus'

describe('useInteractionStatus', () => {
  it('interactionLabel 各交互态中文文案', () => {
    const expected: Record<InteractionKind, string> = {
      idle: '',
      pan: '平移视图…',
      marquee: '框选选择…',
      move: '拖动图片…',
      resize: '调整大小…',
      rotate: '旋转…',
    }
    for (const kind of Object.keys(expected) as InteractionKind[]) {
      expect(interactionLabel(kind)).toBe(expected[kind])
    }
  })

  it('共享 ref 可写读', () => {
    expect(interactionKind.value).toBe('idle')
    interactionKind.value = 'marquee'
    expect(interactionKind.value).toBe('marquee')
    interactionKind.value = 'idle'
  })
})
