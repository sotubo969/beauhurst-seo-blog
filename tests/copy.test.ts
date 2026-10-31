import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { computeStats, detectColumns, parseCsv, rankRows } from '../server/utils/dataset'
import { buildInsights } from '../server/utils/insights'
import { dataCopy, knownNumbers, mergeCopy } from '../server/utils/copywriter'
import { extractNumbers, verifyCopy } from '../server/utils/factcheck'

const csv = parseCsv(readFileSync(new URL('../samples/uk-fintech-top-100.csv', import.meta.url), 'utf8'))
const ranked = rankRows(detectColumns(csv.headers, csv.rows), csv.rows)
const stats = computeStats(ranked.columns, ranked.rows)
const insights = buildInsights(stats, 'UK fintech')
const input = { industry: 'UK fintech', ...ranked, stats, insights }
const known = knownNumbers(input)
const year = new Date().getFullYear()

describe('insights', () => {
  it('produces findings backed by the data', () => {
    const text = insights.map(i => i.text).join(' ')
    expect(text).toContain('Nevis')
    expect(text).toContain('London')
    expect(text).toContain('Seed')
  })
})

describe('data-led copy', () => {
  const copy = dataCopy(input)

  it('builds a complete article without an LLM', () => {
    expect(copy.title).toBe(`Top 100 UK Fintech Companies in ${year}`)
    expect(copy.metaDescription.length).toBeLessThanOrEqual(160)
    expect(copy.sections.length).toBeGreaterThanOrEqual(4)
    expect(copy.faq.length).toBeGreaterThanOrEqual(2)
  })

  it('passes its own fact-check', () => {
    expect(verifyCopy(copy, known, year).rejected).toEqual([])
  })
})

describe('fact-checking LLM output', () => {
  it('extracts money and percentages', () => {
    expect(extractNumbers('raised £30.3m, 78% in London').map(n => n.value)).toEqual([30.3e6, 78])
  })

  it('removes passages with invented figures and keeps accurate ones', () => {
    const draft = mergeCopy({
      title: 'Top 100 UK Fintech Companies',
      metaDescription: 'The top 100 UK fintech companies.',
      intro: ['Nevis leads with £30.3m raised.'],
      sections: [
        { heading: 'Leaders', paragraphs: ['The top 10 hold 33% of the total.', 'The sector grew 340% last year.'] },
        { heading: 'Regions', paragraphs: ['78 companies are based in London.'] },
      ],
      faq: [{ question: 'How much did Nevis raise?', answer: 'About £95m.' }],
    }, dataCopy(input))

    const result = verifyCopy(draft, known, year)
    expect(result.copy.intro).toEqual(['Nevis leads with £30.3m raised.'])
    expect(result.copy.sections[0]!.paragraphs).toEqual(['The top 10 hold 33% of the total.'])
    expect(result.copy.faq).toEqual([])
    expect(result.rejected).toHaveLength(2)
  })

  it('falls back to data-led copy for malformed responses', () => {
    const fallback = dataCopy(input)
    const merged = mergeCopy({ sections: 'nope', keywords: 42 }, fallback)
    expect(merged.sections).toEqual(fallback.sections)
    expect(merged.title).toBe(fallback.title)
  })
})
