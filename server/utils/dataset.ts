import Papa from 'papaparse'
import type { Breakdown, ColumnInfo, ColumnRole, DatasetStats } from '~~/shared/types'

const MAX_ROWS = 1000

export function parseCsv(text: string) {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: h => h.trim(),
    transform: v => v.trim(),
  })

  const headers = (result.meta.fields ?? []).filter(Boolean)
  if (headers.length < 2) throw new Error('The CSV needs a header row and at least two columns.')

  const rows = result.data.filter(row => headers.some(h => row[h])).slice(0, MAX_ROWS)
  if (!rows.length) throw new Error('The CSV has no data rows.')

  return { headers, rows }
}

/** Turns "£30,314,247", "$1.2m" or "4500" into a number. Returns null for non-numeric text. */
export function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null
  const match = raw.replace(/,/g, '').match(/^[^\d-]{0,3}(-?\d+(?:\.\d+)?)\s*([kmb]n?)?\b/i)
  if (!match) return null
  const multipliers: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, bn: 1e9 }
  return Number(match[1]) * (multipliers[(match[2] ?? '').toLowerCase()] ?? 1)
}

const share = (values: string[], test: (v: string) => boolean) =>
  values.length ? values.filter(test).length / values.length : 0

/**
 * Works out what each column is for, using header names first and the shape
 * of the values second, so new datasets don't need any configuration.
 */
export function detectColumns(headers: string[], rows: Record<string, string>[]): ColumnInfo[] {
  const roles = new Map<string, ColumnRole>()
  const sample = (h: string) => rows.map(r => r[h] ?? '').filter(Boolean)
  const claim = (role: ColumnRole, pick: (h: string) => boolean) => {
    if ([...roles.values()].includes(role)) return
    const found = headers.find(h => !roles.has(h) && pick(h))
    if (found) roles.set(found, role)
  }

  claim('rank', h => /^(rank|position|#|no\.?)$/i.test(h))
  claim('url', h => share(sample(h), v => /^(https?:\/\/|www\.)/i.test(v)) > 0.6)
  claim('name', h => /(company|name|organi[sz]ation|business|brand|startup)/i.test(h))
  claim('value', h =>
    /(raised|funding|revenue|turnover|valuation|amount|invest|capital|sales)/i.test(h)
    && share(sample(h), v => parseNumber(v) !== null) > 0.8)
  claim('value', h =>
    /[£$€]/.test(sample(h).join('')) && share(sample(h), v => parseNumber(v) !== null) > 0.8)
  claim('description', h => /(description|summary|about|overview)/i.test(h))
  claim('tags', h => share(sample(h), v => /;|\|/.test(v)) > 0.3)
  claim('description', h => sample(h).reduce((sum, v) => sum + v.length, 0) / Math.max(sample(h).length, 1) > 60)
  claim('name', h => share(sample(h), v => parseNumber(v) === null) > 0.9)

  for (const h of headers) {
    if (roles.has(h)) continue
    const distinct = new Set(sample(h)).size
    roles.set(h, distinct >= 1 && distinct <= Math.max(12, rows.length * 0.3) ? 'category' : 'other')
  }

  return headers.map(key => ({ key, role: roles.get(key)! }))
}

export const columnFor = (columns: ColumnInfo[], role: ColumnRole) =>
  columns.find(c => c.role === role)?.key ?? null

/** Sorts by the rank column (or by value if there isn't one) and fills in a rank. */
export function rankRows(columns: ColumnInfo[], rows: Record<string, string>[]) {
  const rankKey = columnFor(columns, 'rank')
  const valueKey = columnFor(columns, 'value')

  if (rankKey) {
    return [...rows].sort((a, b) => (parseNumber(a[rankKey]) ?? Infinity) - (parseNumber(b[rankKey]) ?? Infinity))
  }

  const sorted = valueKey
    ? [...rows].sort((a, b) => (parseNumber(b[valueKey]) ?? 0) - (parseNumber(a[valueKey]) ?? 0))
    : rows
  columns.unshift({ key: 'Rank', role: 'rank' })
  return sorted.map((row, i) => ({ Rank: String(i + 1), ...row }))
}

/** Orders bands like "<5", "5-9", "10-24" numerically (N/A last), everything else by size. */
function sortBreakdown(items: Breakdown['items']) {
  const leading = (label: string) => parseNumber(label.replace(/^[<>~+]/, ''))
  const numeric = items.filter(i => leading(i.label) !== null)
  if (numeric.length >= items.length - 1 && numeric.length > 1) {
    return items.sort((a, b) => (leading(a.label) ?? Infinity) - (leading(b.label) ?? Infinity))
  }
  return items.sort((a, b) => b.count - a.count)
}

export function computeStats(columns: ColumnInfo[], rows: Record<string, string>[]): DatasetStats {
  const nameKey = columnFor(columns, 'name')
  const valueKey = columnFor(columns, 'value')
  const tagsKey = columnFor(columns, 'tags')
  const valueOf = (row: Record<string, string>) => (valueKey ? parseNumber(row[valueKey]) ?? 0 : 0)
  const nameOf = (row: Record<string, string>) => (nameKey ? row[nameKey] : '') || 'Unknown'

  const values = rows.map(valueOf)
  const sortedValues = [...values].sort((a, b) => a - b)
  const total = values.reduce((a, b) => a + b, 0)
  const mid = Math.floor(sortedValues.length / 2)
  const median = sortedValues.length % 2 ? sortedValues[mid]! : (sortedValues[mid - 1]! + sortedValues[mid]!) / 2
  const byValue = [...rows].sort((a, b) => valueOf(b) - valueOf(a))
  const top10Total = byValue.slice(0, 10).reduce((sum, r) => sum + valueOf(r), 0)

  const breakdowns: Breakdown[] = columns
    .filter(c => c.role === 'category')
    .map(({ key }) => {
      const groups = new Map<string, { count: number, value: number }>()
      for (const row of rows) {
        const label = row[key] || 'Unknown'
        const g = groups.get(label) ?? { count: 0, value: 0 }
        g.count++
        g.value += valueOf(row)
        groups.set(label, g)
      }
      const items = [...groups].map(([label, g]) => ({ label, ...g, share: g.count / rows.length }))
      return { column: key, items: sortBreakdown(items) }
    })

  let tags: DatasetStats['tags'] = null
  if (tagsKey) {
    const counts = new Map<string, number>()
    for (const row of rows) {
      for (const tag of new Set((row[tagsKey] ?? '').split(/[;|]/).map(t => t.trim()).filter(Boolean))) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    tags = {
      column: tagsKey,
      items: [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 12),
    }
  }

  const sampleValues = valueKey ? rows.map(r => r[valueKey]).join('') : ''
  const currency = ['£', '$', '€'].find(c => sampleValues.includes(c)) ?? ''

  return {
    count: rows.length,
    valueColumn: valueKey,
    currency,
    total,
    mean: rows.length ? total / rows.length : 0,
    median: median ?? 0,
    top: valueKey && byValue[0] ? { name: nameOf(byValue[0]), value: valueOf(byValue[0]) } : null,
    bottom: valueKey && byValue.at(-1) ? { name: nameOf(byValue.at(-1)!), value: valueOf(byValue.at(-1)!) } : null,
    top10Total,
    top10Share: total ? top10Total / total : 0,
    breakdowns,
    tags,
  }
}
