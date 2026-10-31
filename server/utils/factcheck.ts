import type { BlogCopy } from '../../shared/types'

const NUMBER_PATTERN = /([£$€])?\s?(\d[\d,]*(?:\.\d+)?)\s?(bn|billion|m|million|k|%)?/gi
const UNITS: Record<string, number> = { bn: 1e9, billion: 1e9, m: 1e6, million: 1e6, k: 1e3 }

/** Pulls every figure out of a piece of text, e.g. "£30.3m" -> 30300000, "78%" -> 78. */
export function extractNumbers(text: string) {
  const found: { raw: string, value: number, percent: boolean }[] = []
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const [raw, , digits, unit = ''] = match
    const value = Number(digits!.replace(/,/g, '')) * (UNITS[unit.toLowerCase()] ?? 1)
    if (Number.isFinite(value)) found.push({ raw: raw.trim(), value, percent: unit === '%' })
  }
  return found
}

/**
 * Checks that every number the LLM wrote can be traced back to the dataset.
 * Figures are matched with a small tolerance so rounding ("£30.3m" for £30,314,247) passes.
 */
export function createFactChecker(knownNumbers: number[]) {
  const known = knownNumbers.filter(Number.isFinite)

  const isKnown = (value: number) => {
    // Small whole numbers (counts, "top 10", list positions) are allowed if they are in the data
    return known.some((k) => {
      if (k === value) return true
      const tolerance = Math.max(Math.abs(k) * 0.02, value < 100 ? 0.5 : 0)
      return Math.abs(k - value) <= tolerance
    })
  }

  return (text: string) => extractNumbers(text).filter(n => !isKnown(n.value))
}

/** Removes any paragraph or answer that contains a figure the data can't back up. */
export function verifyCopy(copy: BlogCopy, knownNumbers: number[], year: number) {
  const unverified = createFactChecker([...knownNumbers, year, year - 1])
  const rejected: string[] = []
  let checked = 0

  const keep = (text: string) => {
    checked += 1
    const bad = unverified(text)
    if (bad.length) rejected.push(`${bad.map(b => b.raw).join(', ')} in "${text.slice(0, 80)}…"`)
    return !bad.length
  }

  const verified: BlogCopy = {
    ...copy,
    intro: copy.intro.filter(keep),
    sections: copy.sections
      .map(s => ({ ...s, paragraphs: s.paragraphs.filter(keep) }))
      .filter(s => s.paragraphs.length),
    faq: copy.faq.filter(f => keep(`${f.question} ${f.answer}`)),
  }

  // The title and meta description are too important to drop silently, so they fall back instead
  const titleOk = keep(copy.title)
  const metaOk = keep(copy.metaDescription)

  return { copy: verified, titleOk, metaOk, checked, rejected }
}
