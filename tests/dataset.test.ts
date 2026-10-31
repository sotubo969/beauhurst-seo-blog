import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyRoleOverrides, computeStats, detectColumns, distributionBands, gini, parseCsv, parseNumber, rankRows } from '../server/utils/dataset'

const fintech = parseCsv(readFileSync(new URL('../samples/uk-fintech-top-100.csv', import.meta.url), 'utf8'))

describe('parseNumber', () => {
  it.each([
    ['£30,314,247', 30314247],
    ['$1.2m', 1.2e6],
    ['€3bn', 3e9],
    ['4500', 4500],
    ['250k', 250000],
  ])('parses %s', (raw, expected) => expect(parseNumber(raw)).toBe(expected))

  it('returns null for text', () => {
    expect(parseNumber('London')).toBeNull()
    expect(parseNumber('')).toBeNull()
  })
})

describe('detectColumns', () => {
  it('maps the fintech dataset without configuration', () => {
    const roles = Object.fromEntries(detectColumns(fintech.headers, fintech.rows).map(c => [c.key, c.role]))
    expect(roles).toEqual({
      'Rank': 'rank',
      'Company': 'name',
      'Region': 'category',
      'Stage': 'category',
      'Employees': 'category',
      'Total Raised': 'value',
      'Description': 'description',
      'Website': 'url',
      'Industries': 'tags',
    })
  })

  it('handles a differently shaped dataset with no rank column', () => {
    const { headers, rows } = parseCsv([
      'Organisation,City,Revenue (USD),Focus areas',
      'Alpha,Leeds,"$2,000,000",AI|Diagnostics',
      'Beta,York,"$9,000,000",Genomics',
      'Gamma,Leeds,"$5,500,000",AI',
    ].join('\n'))
    const columns = detectColumns(headers, rows)
    const ranked = rankRows(columns, rows)

    expect(ranked.columns[0]).toEqual({ key: 'Rank', role: 'rank' })
    expect(ranked.rows.map(r => r.Organisation)).toEqual(['Beta', 'Gamma', 'Alpha'])
    expect(columns.find(c => c.key === 'Focus areas')?.role).toBe('tags')
  })

  it('keeps single-use roles unique when the user overrides them', () => {
    const columns = applyRoleOverrides(detectColumns(fintech.headers, fintech.rows), { Region: 'name' })
    expect(columns.filter(c => c.role === 'name')).toHaveLength(1)
  })
})

describe('computeStats', () => {
  const columns = detectColumns(fintech.headers, fintech.rows)
  const { rows } = rankRows(columns, fintech.rows)
  const stats = computeStats(columns, rows)

  it('calculates headline figures', () => {
    expect(stats.count).toBe(100)
    expect(stats.currency).toBe('£')
    expect(stats.top?.name).toBe('Nevis')
    expect(stats.total).toBeCloseTo(622_301_270, 0)
    expect(stats.leaders).toHaveLength(10)
  })

  it('breaks companies down by category with leaders', () => {
    const region = stats.breakdowns.find(b => b.column === 'Region')!
    const london = region.items.find(i => i.label === 'London')!
    expect(london.count).toBe(78)
    expect(london.leader).toBe('Nevis')
    expect(region.items.reduce((sum, i) => sum + i.count, 0)).toBe(100)
  })

  it('orders size bands numerically', () => {
    const employees = stats.breakdowns.find(b => b.column === 'Employees')!.items.map(i => i.label)
    expect(employees.indexOf('<5')).toBeLessThan(employees.indexOf('10-24'))
    expect(employees.at(-1)).toBe('N/A')
  })
})

describe('gini and distribution', () => {
  it('is 0 for equal values and high for concentrated values', () => {
    expect(gini([5, 5, 5, 5])).toBeCloseTo(0)
    expect(gini([0, 0, 0, 100])).toBeCloseTo(0.75)
  })

  it('creates bands that cover every value', () => {
    const values = [1.2e6, 2e6, 3e6, 4.5e6, 7e6, 12e6, 30e6]
    const bands = distributionBands(values, '£')
    expect(bands.reduce((sum, b) => sum + b.count, 0)).toBe(values.length)
    expect(bands[0]!.label).toBe('£1.0m–£2.5m')
  })
})
