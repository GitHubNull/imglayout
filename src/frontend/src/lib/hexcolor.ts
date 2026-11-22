// PrimeVue 4 ColorPicker（format=hex，默认）发出的是不带 # 的 6 位十六进制（如 "ff0000"），
// 而项目文档/Rust parse_hex_color/Canvas fillStyle 均以 "#RRGGBB" 为准——此处统一收敛。
export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const v = value.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(v) || /^#[0-9A-Fa-f]{3}$/.test(v)) return v.toUpperCase()
  if (/^[0-9A-Fa-f]{6}$/.test(v)) return `#${v.toUpperCase()}`
  return fallback
}
