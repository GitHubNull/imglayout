// 极简 Markdown 渲染（仅供 CHANGELOG 等受信任的本地文本）：先整体转义 HTML，再只放行
// 标题（#/##/###）、无序列表、加粗、行内代码、链接五种语法，无 v-html 注入面。
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inline(s: string): string {
  // 顺序敏感：先 code（不吃其它语法），再 bold，最后 link
  return s
    .replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
}

export function renderMarkdownLite(md: string): string {
  const lines = md.split(/\r?\n/)
  const out: string[] = []
  let inList = false

  const closeList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const trimmed = line.trim()
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed)

    if (!trimmed) {
      closeList()
      continue
    }
    if (heading) {
      closeList()
      const level = heading[1].length
      out.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`)
      continue
    }
    const item = /^-\s+(.*)$/.exec(trimmed)
    if (item) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${inline(escapeHtml(item[1]))}</li>`)
      continue
    }
    closeList()
    out.push(`<p>${inline(escapeHtml(trimmed))}</p>`)
  }
  closeList()
  return out.join('\n')
}
