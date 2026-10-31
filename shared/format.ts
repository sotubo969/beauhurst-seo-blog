export function formatMoney(value: number, currency = '') {
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${currency}${(value / 1e9).toFixed(2)}bn`
  if (abs >= 1e6) return `${currency}${(value / 1e6).toFixed(1)}m`
  if (abs >= 1e3) return `${currency}${(value / 1e3).toFixed(0)}k`
  return `${currency}${Math.round(value).toLocaleString('en-GB')}`
}

export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`

/** "UK fintech" -> "UK Fintech". Leaves acronyms and already-capitalised words alone. */
export const titleCase = (text: string) =>
  text.replace(/\b([a-z])([a-z]*)/g, (_, first: string, rest: string) => first.toUpperCase() + rest)

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
