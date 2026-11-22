// 画布交互状态共享：InteractionController（plain class）写入，StatusBar 读取。
// 模块级共享 ref，避免为一次交互状态单独建 Pinia store。
import { ref } from 'vue'

export type InteractionKind = 'idle' | 'pan' | 'marquee' | 'move' | 'resize' | 'rotate'

/** 当前画布交互状态机所处的交互种类 */
export const interactionKind = ref<InteractionKind>('idle')

const LABELS: Record<InteractionKind, string> = {
  idle: '',
  pan: '平移视图…',
  marquee: '框选选择…',
  move: '拖动图片…',
  resize: '调整大小…',
  rotate: '旋转…',
}

export function interactionLabel(kind: InteractionKind): string {
  return LABELS[kind]
}
