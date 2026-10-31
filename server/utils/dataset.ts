import Papa from 'papaparse'
import type { Breakdown, ColumnInfo, ColumnRole, DatasetStats, GroupStat } from '../../shared/types'
import { COLUMN_ROLES } from '../../shared/types'
import { formatMoney } from '../../shared/format'

const MAX_ROWS = 1000
const SINGLE_ROLES: ColumnRole[] = ['rank', 'name', 'value', 'tags', 'description', 'url']

type Row = Record<string, string>

export function parseCsv(text: string) {
  const result = Papa.parse<Row>(text.replace(/^﻿/, ''), {
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
export function detectColumns(headers: string[], rows: Row[]): ColumnInfo[] {
  const roles = new Map<string, ColumnRole>()
  const sample = (h: string) => rows.map(r => r[h] ?? '').filter(Boolean)
  const numeric = (h: string) => share(sample(h), v => parseNumber(v) !== null)
  const claim = (role: ColumnRole, pick: (h: string) => boolean) => {
    if ([...roles.values()].includes(role)) return
    const found = headers.find(h => !roles.has(h) && pick(h))
    if (found) roles.set(found, role)
  }

  claim('rank', h => /^(rank|ranking|position|#|no\.?)$/i.test(h))
  claim('url', h => share(sample(h), v => /^(https?:\/\/|www\.)/i.test(v)) > 0.6)
  claim('name', h => /(company|name|organi[sz]ation|business|brand|startup)/i.test(h))
  claim('value', h => /(raised|funding|revenue|turnover|valuation|amount|invest|capital|sales)/i.test(h) && numeric(h) > 0.8)
  claim('value', h => /[£$€]/.test(sample(h).join('')) && numeric(h) > 0.8)
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

/** Applies roles chosen by the user in the upload preview, keeping single-use roles unique. */
export function applyRoleOverrides(columns: ColumnInfo[], overrides: Record<string, string> | undefined) {
  if (!overrides) return columns
  const result = columns.map(c => {
    const role = overrides[c.key] as ColumnRole
    return COLUMN_ROLES.includes(role) ? { ...c, role } : c
  })
  for (const role of SINGLE_ROLES) {
    const matches = result.filter(c => c.role === role)
    matches.slice(1).forEach(c => (c.role = 'other'))
  }
  return result
}

export const columnFor = (columns: ColumnInfo[], role: ColumnRole) =>
  columns.find(c => c.role === role)?.key ?? null

/** Sorts by the rank column (or by value if there isn't one) and adds a rank column when missing. */
export function rankRows(columns: ColumnInfo[], rows: Row[]): { columns: ColumnInfo[], rows: Row[] } {
  const rankKey = columnFor(columns, 'rank')
  const valueKey = columnFor(columns, 'value')

  if (rankKey) {
    const sorted = [...rows].sort((a, b) => (parseNumber(a[rankKey]) ?? Infinity) - (parseNumber(b[rankKey]) ?? Infinity))
    return { columns, rows: sorted }
  }

  const sorted = valueKey
    ? [...rows].sort((a, b) => (parseNumber(b[valueKey]) ?? 0) - (parseNumber(a[valueKey]) ?? 0))
    : rows
  return {
    columns: [{ key: 'Rank', role: 'rank' }, ...columns],
    rows: sorted.map((row, i) => ({ Rank: String(i + 1), ...row })),
  }
}

/** Gini coefficient: 0 means value is spread evenly, 1 means one company holds everything. */
export function gini(values: number[]) {
  const sorted = values.filter(v => v >= 0).sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  if (!sorted.length || !sum) return 0
  const weighted = sorted.reduce((acc, v, i) => acc + (i + 1) * v, 0)
  return (2 * weighted) / (sorted.length * sum) - (sorted.length + 1) / sorted.length
}

/** Splits values into readable bands on a 1 / 2.5 / 5 scale, e.g. £1m–2.5m, £2.5m–5m. */
export function distributionBands(values: number[], currency: string) {
  const positive = values.filter(v => v > 0)
  if (positive.length < 5) return []
  const min = Math.min(...positive)
  const max = Math.max(...positive)

  const edges: number[] = []
  for (let exp = Math.floor(Math.log10(min)); edges.length === 0 || edges.at(-1)! <= max; exp++) {
    for (const step of [1, 2.5, 5]) edges.push(step * 10 ** exp)
  }
  const start = Math.max(0, edges.findLastIndex(e => e <= min))
  const used = edges.slice(start)

  const bands = used.slice(0, -1).map((low, i) => {
    const high = used[i + 1]!
    return {
      label: `${formatMoney(low, currency)}–${formatMoney(high, currency)}`,
      count: positive.filter(v => v >= low && v < high).length,
    }
  })
  // Trim empty bands at either end so the chart starts and ends on real data
  while (bands.length && !bands[0]!.count) bands.shift()
  while (bands.length && !bands.at(-1)!.count) bands.pop()
  return bands
}

/** Orders bands like "<5", "5-9", "10-24" numerically (N/A last), everything else by size. */
function sortGroups(items: GroupStat[]) {
  // "<5" sorts just before "5-9"
  const leading = (label: string) => {
    const n = parseNumber(label.replace(/^[<>~+]/, ''))
    return n !== null && label.startsWith('<') ? n - 0.5 : n
  }
  const numeric = items.filter(i => leading(i.label) !== null)
  if (numeric.length >= items.length - 1 && numeric.length > 1) {
    return items.sort((a, b) => (leading(a.label) ?? Infinity) - (leading(b.label) ?? Infinity))
  }
  return items.sort((a, b) => b.count - a.count)
}

export function computeStats(columns: ColumnInfo[], rows: Row[]): DatasetStats {
  const nameKey = columnFor(columns, 'name')
  const valueKey = columnFor(columns, 'value')
  const tagsKey = columnFor(columns, 'tags')
  const valueOf = (row: Row) => (valueKey ? parseNumber(row[valueKey]) ?? 0 : 0)
  const nameOf = (row: Row) => (nameKey ? row[nameKey] : '') || 'Unknown'

  const values = rows.map(valueOf)
  const sortedValues = [...values].sort((a, b) => a - b)
  const total = values.reduce((a, b) => a + b, 0)
  const mid = Math.floor(sortedValues.length / 2)
  const median = sortedValues.length % 2 ? sortedValues[mid]! : (sortedValues[mid - 1]! + sortedValues[mid]!) / 2
  const byValue = [...rows].sort((a, b) => valueOf(b) - valueOf(a))
  const top10Total = byValue.slice(0, 10).reduce((sum, r) => sum + valueOf(r), 0)

  const sampleValues = valueKey ? rows.map(r => r[valueKey]).join('') : ''
  const currency = ['£', '$', '€'].find(c => sampleValues.includes(c)) ?? ''

  // Rows arrive in rank order, so the first row seen for a group is its leader
  const group = (labelsOf: (row: Row) => string[]) => {
    const groups = new Map<string, { count: number, value: number, leader: string }>()
    for (const row of rows) {
      for (const label of labelsOf(row)) {
        const g = groups.get(label) ?? { count: 0, value: 0, leader: nameOf(row) }
        g.count++
        g.value += valueOf(row)
        groups.set(label, g)
      }
    }
    return [...groups].map(([label, g]) => ({
      label,
      ...g,
      share: g.count / rows.length,
      valueShare: total ? g.value / total : 0,
      average: g.value / g.count,
    }))
  }

  const breakdowns: Breakdown[] = columns
    .filter(c => c.role === 'category')
    .map(({ key }) => ({ column: key, items: sortGroups(group(row => [row[key] || 'Unknown'])) }))

  const tags = tagsKey
    ? {
        column: tagsKey,
        items: group(row => [...new Set((row[tagsKey] ?? '').split(/[;|]/).map(t => t.trim()).filter(Boolean))])
          .sort((a, b) => b.count - a.count)
          .slice(0, 12),
      }
    : null

  const hasValue = !!valueKey && total > 0

  return {
    count: rows.length,
    valueColumn: hasValue ? valueKey : null,
    currency,
    total,
    mean: rows.length ? total / rows.length : 0,
    median: median ?? 0,
    gini: hasValue ? gini(values) : 0,
    top: hasValue ? { name: nameOf(byValue[0]!), value: valueOf(byValue[0]!) } : null,
    bottom: hasValue ? { name: nameOf(byValue.at(-1)!), value: valueOf(byValue.at(-1)!) } : null,
    top10Total,
    top10Share: total ? top10Total / total : 0,
    leaders: hasValue ? byValue.slice(0, 10).map(r => ({ name: nameOf(r), value: valueOf(r) })) : [],
    distribution: hasValue ? distributionBands(values, currency) : [],
    breakdowns,
    tags,
  }
}
