import { describe, expect, it } from 'vitest'
import { renderMarkdownLite } from './markdown'

describe('renderMarkdownLite（极简 Markdown 渲染）', () => {
  it('渲染一/二/三级标题', () => {
    const html = renderMarkdownLite('# A\n## B\n### C')
    expect(html).toContain('<h1>A</h1>')
    expect(html).toContain('<h2>B</h2>')
    expect(html).toContain('<h3>C</h3>')
  })

  it('连续 - 行合并为一个列表，空行后闭合', () => {
    const html = renderMarkdownLite('- 甲\n- 乙\n\n段落')
    expect(html).toContain('<ul>\n<li>甲</li>\n<li>乙</li>\n</ul>')
    expect(html).toContain('<p>段落</p>')
    expect(html.indexOf('</ul>')).toBeLessThan(html.indexOf('<p>段落</p>'))
  })

  it('行内加粗 / 代码 / 链接', () => {
    const html = renderMarkdownLite('含 **粗体**、`code` 与 [链接](https://example.com/a) 的段落')
    expect(html).toContain('<strong>粗体</strong>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<a href="https://example.com/a" target="_blank" rel="noopener noreferrer">链接</a>')
  })

  it('HTML 特殊字符先转义，脚本注入被中和', () => {
    const html = renderMarkdownLite('<script>alert(1)</script> & "引号"')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;引号&quot;')
  })

  it('非 http(s) 链接不生成锚点', () => {
    const html = renderMarkdownLite('[x](javascript:alert(1)) [y](ftp://a)')
    expect(html).not.toContain('<a ')
    expect(html).toContain('javascript:alert(1)')
  })

  it('CHANGELOG 片段端到端：标题 + 列表 + 加粗', () => {
    const html = renderMarkdownLite('## [Unreleased]\n\n### Added\n- 新增 **某功能**')
    expect(html).toContain('<h2>[Unreleased]</h2>')
    expect(html).toContain('<h3>Added</h3>')
    expect(html).toContain('<li>新增 <strong>某功能</strong></li>')
  })
})
