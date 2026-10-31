import type { BlogCopy, ColumnInfo, CopyReview, DatasetStats, Insight } from '../../shared/types'
import { formatMoney, formatPercent, titleCase } from '../../shared/format'
import { columnFor, parseNumber } from './dataset'
import { verifyCopy } from './factcheck'

export type CopyMode = 'ai' | 'data'

export interface CopyInput {
  industry: string
  columns: ColumnInfo[]
  rows: Record<string, string>[]
  stats: DatasetStats
  insights: Insight[]
}

const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : (items[0] ?? '')

function concentrationLabel(gini: number) {
  if (gini >= 0.5) return 'highly concentrated'
  if (gini >= 0.3) return 'moderately concentrated'
  return 'relatively evenly spread'
}

/** A closing paragraph that draws the breakdowns together rather than repeating them. */
function summarise(stats: DatasetStats, Industry: string) {
  const traits = stats.breakdowns
    .map((b) => {
      const lead = [...b.items].sort((x, y) => y.count - x.count)[0]!
      return lead.share >= 0.6 ? `${formatPercent(lead.share)} share the same ${b.column.toLowerCase()} (${lead.label})` : null
    })
    .filter((t): t is string => !!t)

  const parts: string[] = []
  if (stats.valueColumn) {
    parts.push(`${stats.valueColumn.toLowerCase()} across the top ${Industry} companies is ${concentrationLabel(stats.gini)}`)
  }
  if (traits.length) parts.push(`the group is fairly uniform: ${list(traits)}`)
  if (!parts.length) return null

  const sentence = `Taken together, ${list(parts)}.`
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} For investors, partners and analysts, the ranking offers a quick way to identify the most established names in the sector and where activity is clustered.`
}

/* ------------------------------------------------------------------ */
/* Data-led copy: written entirely from the statistics, no LLM needed  */
/* ------------------------------------------------------------------ */

export function dataCopy({ industry, rows, columns, stats, insights }: CopyInput): BlogCopy {
  const money = (n: number) => formatMoney(n, stats.currency)
  const year = new Date().getFullYear()
  const Industry = titleCase(industry)
  const metric = stats.valueColumn?.toLowerCase()
  const nameKey = columnFor(columns, 'name')!
  const sections: BlogCopy['sections'] = []

  if (metric && stats.top) {
    const podium = stats.leaders.slice(0, 3).map(l => `${l.name} (${money(l.value)})`)
    sections.push({
      heading: `The top ${Industry} companies by ${metric}`,
      paragraphs: [
        `${list(podium)} make up the top three. Together the ten highest-ranked companies account for ${money(stats.top10Total)}, or ${formatPercent(stats.top10Share)} of the ${money(stats.total)} recorded across the full list.`,
        `Reaching the ranking is itself a marker of scale: the company in last place has ${money(stats.bottom!.value)} in ${metric}.`,
      ],
    })

    const commonBand = [...stats.distribution].sort((a, b) => b.count - a.count)[0]
    sections.push({
      heading: `How ${metric} is distributed across ${Industry}`,
      paragraphs: [
        `The median company has ${money(stats.median)} in ${metric}, while the average is ${money(stats.mean)}. `
          + (stats.mean > stats.median * 1.2
            ? 'Because the average sits well above the median, a small group of large companies is lifting the overall figures.'
            : 'With the two figures close together, most companies sit near the middle of the range.'),
        ...(commonBand
          ? [`The most common band is ${commonBand.label}, which covers ${commonBand.count} companies. Overall, ${metric} is ${concentrationLabel(stats.gini)} (Gini coefficient ${stats.gini.toFixed(2)}).`]
          : []),
      ],
    })
  }

  for (const breakdown of stats.breakdowns) {
    const column = breakdown.column.toLowerCase()
    const byCount = [...breakdown.items].sort((a, b) => b.count - a.count)
    const [first, second] = byCount

    const paragraphs = first!.share === 1
      ? [`Every company in the ranking shares the same ${column}: ${first!.label}. That makes this list a like-for-like comparison of ${Industry} companies at the same point.`]
      : [
          `The largest group by ${column} is ${first!.label}, with ${first!.count} companies (${formatPercent(first!.share)})`
            + (second ? `, followed by ${second.label} with ${second.count}.` : '.')
            + (metric ? ` Together this group accounts for ${formatPercent(first!.valueShare)} of the combined ${metric}, led by ${first!.leader}.` : ''),
        ]

    sections.push({ heading: `${Industry} companies by ${column}`, paragraphs })
  }

  if (stats.tags?.items.length) {
    const top = stats.tags.items.slice(0, 4)
    sections.push({
      heading: `The most common ${Industry} sub-sectors`,
      paragraphs: [
        `Companies can sit in more than one sub-sector. The most frequent are ${list(top.map(t => `${t.label} (${t.count})`))}.`,
      ],
    })
  }

  const summary = summarise(stats, Industry)
  if (summary) sections.push({ heading: `What the data tells us about ${Industry}`, paragraphs: [summary] })

  const faq: BlogCopy['faq'] = [
    {
      question: `What is the top ${Industry} company?`,
      answer: metric && stats.top
        ? `${stats.top.name} ranks first with ${money(stats.top.value)} in ${metric}.`
        : `${rows[0]?.[nameKey]} ranks first in this list.`,
    },
  ]
  if (metric) {
    faq.push({
      question: `How much do the top ${stats.count} ${Industry} companies account for in total?`,
      answer: `Together they account for ${money(stats.total)} in ${metric}, an average of ${money(stats.mean)} and a median of ${money(stats.median)} per company.`,
    })
  }
  const location = stats.breakdowns.find(b => /(region|city|location|country|county|area)/i.test(b.column))
  if (location) {
    const lead = [...location.items].sort((a, b) => b.count - a.count)[0]!
    faq.push({
      question: `Where are most ${Industry} companies based?`,
      answer: `${lead.label} is home to ${lead.count} of the ${stats.count} companies in the ranking (${formatPercent(lead.share)}).`,
    })
  }

  return {
    title: `Top ${stats.count} ${Industry} Companies in ${year}`,
    metaDescription: (metric && stats.top
      ? `The top ${stats.count} ${Industry} companies ranked by ${metric}, led by ${stats.top.name}. Full ranking, key statistics and insights for ${year}.`
      : `The top ${stats.count} ${Industry} companies in ${year}: full ranking table, key statistics and insights.`).slice(0, 160),
    intro: [
      `This ranking lists the top ${stats.count} ${Industry} companies${metric ? ` by ${metric}` : ''}. Every figure on this page is calculated directly from the underlying dataset.`,
      `Below you will find the headline numbers, how the companies break down${stats.breakdowns.length ? ` by ${list(stats.breakdowns.map(b => b.column.toLowerCase()))}` : ''}, and the full ranking table.`,
    ],
    sections,
    faq,
    keywords: [...new Set([`${industry} companies`, `top ${industry} companies`, `${industry} companies ${year}`, `${industry} ranking`].map(k => k.toLowerCase()))],
  }
}

/* ------------------------------------------------------------------ */
/* AI-assisted copy: the LLM writes prose around pre-computed findings */
/* ------------------------------------------------------------------ */

export function buildPrompt(input: CopyInput) {
  const { stats, insights, industry, rows, columns } = input
  const money = (n: number) => formatMoney(n, stats.currency)
  const nameKey = columnFor(columns, 'name')!
  const descKey = columnFor(columns, 'description')
  const year = new Date().getFullYear()

  const facts = [
    `Companies in the list: ${stats.count}`,
    ...(stats.valueColumn
      ? [
          `Ranked by: ${stats.valueColumn}`,
          `Total: ${money(stats.total)} | Average: ${money(stats.mean)} | Median: ${money(stats.median)}`,
          `Top 10 combined: ${money(stats.top10Total)} (${formatPercent(stats.top10Share)} of total)`,
        ]
      : []),
    ...stats.breakdowns.map(b => `By ${b.column}: ${[...b.items].sort((x, y) => y.count - x.count).slice(0, 4).map(i => `${i.label} ${i.count}`).join(', ')}`),
    ...(stats.tags ? [`Top sub-sectors: ${stats.tags.items.slice(0, 5).map(t => `${t.label} ${t.count}`).join(', ')}`] : []),
  ]

  const leaders = rows.slice(0, 10).map((row, i) =>
    `${i + 1}. ${row[nameKey]}${stats.valueColumn ? ` (${money(parseNumber(row[stats.valueColumn]) ?? 0)})` : ''}${descKey && row[descKey] ? `: ${row[descKey]}` : ''}`)

  return `You are an editor at a UK business-intelligence publisher writing an SEO article about ${industry}.
The analysis is already done. Your job is to turn it into clear, professional prose in UK English.

STRICT RULES
- Only use figures that appear below, written the same way. Never calculate new numbers, estimate, or add dates.
- Do not invent facts about companies beyond their descriptions.
- No hype words ("revolutionary", "game-changing"), no exclamation marks.
- Do not list the full ranking; a table is shown separately.

FACTS
${facts.join('\n')}

KEY FINDINGS (already verified)
${insights.map(i => `- ${i.text}`).join('\n')}

TOP 10
${leaders.join('\n')}

Return only JSON in this shape:
{
  "title": "H1, max 65 characters, main keyword first, e.g. 'Top ${stats.count} ${titleCase(industry)} Companies in ${year}'",
  "metaDescription": "140-155 characters with the main keyword and a clear reason to click",
  "intro": ["two short paragraphs"],
  "sections": [{ "heading": "descriptive H2 containing a keyword", "paragraphs": ["1-3 paragraphs"] }],
  "faq": [{ "question": "a question people search for", "answer": "1-2 sentences" }],
  "keywords": ["5-8 search phrases"]
}
Write 4-5 sections (the leaders, concentration, the breakdowns, notable companies from the top 10, outlook based only on the findings) and 3-4 FAQs.`
}

/** Every number a reader could legitimately see, used to fact-check the LLM output. */
export function knownNumbers({ rows, stats }: CopyInput) {
  const numbers: number[] = [stats.count, stats.total, stats.mean, stats.median, stats.top10Total, stats.top10Share * 100, stats.gini, 3, 10]
  for (const row of rows) {
    for (const v of Object.values(row)) {
      const n = parseNumber(v)
      if (n !== null) numbers.push(n)
    }
  }
  for (const group of [...stats.breakdowns.flatMap(b => b.items), ...(stats.tags?.items ?? [])]) {
    numbers.push(group.count, group.share * 100, group.valueShare * 100, group.value, group.average)
  }
  stats.distribution.forEach(d => numbers.push(d.count))
  if (stats.top && stats.bottom?.value) numbers.push(stats.top.value / stats.bottom.value)
  if (stats.count > 10) numbers.push(stats.top10Share / (10 / stats.count))
  return numbers
}

async function callGemini(prompt: string, apiKey: string, model: string) {
  const res = await $fetch<any>(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey },
    body: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    },
    timeout: 60_000,
  })
  return res.candidates?.[0]?.content?.parts?.[0]?.text as string
}

async function callOllama(prompt: string, host: string, model: string) {
  const res = await $fetch<{ response: string }>(`${host.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    body: { model, prompt, format: 'json', stream: false, options: { temperature: 0.4 } },
    timeout: 180_000,
  })
  return res.response
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const textList = (v: unknown) => (Array.isArray(v) ? v.filter(isText).map(s => s.trim()) : [])

/** Normalises whatever the model returned into BlogCopy, filling gaps from the data-led copy. */
export function mergeCopy(raw: any, fallback: BlogCopy): BlogCopy {
  const sections = Array.isArray(raw?.sections)
    ? raw.sections
        .filter((s: any) => isText(s?.heading))
        .map((s: any) => ({ heading: s.heading.trim(), paragraphs: textList(s.paragraphs) }))
        .filter((s: BlogCopy['sections'][number]) => s.paragraphs.length)
    : []
  const faq = Array.isArray(raw?.faq) ? raw.faq.filter((f: any) => isText(f?.question) && isText(f?.answer)) : []

  return {
    title: isText(raw?.title) && raw.title.length <= 80 ? raw.title.trim() : fallback.title,
    metaDescription: isText(raw?.metaDescription) ? raw.metaDescription.trim().slice(0, 160) : fallback.metaDescription,
    intro: textList(raw?.intro).length ? textList(raw.intro) : fallback.intro,
    sections: sections.length ? sections : fallback.sections,
    faq: faq.length ? faq : fallback.faq,
    keywords: textList(raw?.keywords).length ? textList(raw.keywords).slice(0, 10) : fallback.keywords,
  }
}

export async function writeCopy(input: CopyInput, mode: CopyMode): Promise<{ copy: BlogCopy, review: CopyReview }> {
  const fallback = dataCopy(input)
  if (mode === 'data') {
    return { copy: fallback, review: { mode: 'data', provider: 'none', checkedClaims: 0, rejected: [] } }
  }

  const config = useRuntimeConfig()
  const prompt = buildPrompt(input)
  const providers: [string, () => Promise<string>][] = []

  // Several Gemini models can be listed, so a lighter model takes over when the free quota on the first runs out
  if (config.geminiApiKey) {
    for (const model of String(config.geminiModel).split(',').map(m => m.trim()).filter(Boolean)) {
      providers.push([`gemini:${model}`, () => callGemini(prompt, config.geminiApiKey, model)])
    }
  }
  if (config.ollamaModel) providers.push([`ollama:${config.ollamaModel}`, () => callOllama(prompt, config.ollamaHost, config.ollamaModel)])

  for (const [name, call] of providers) {
    try {
      const text = await call()
      const merged = mergeCopy(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')), fallback)
      const result = verifyCopy(merged, knownNumbers(input), new Date().getFullYear())

      const copy: BlogCopy = {
        ...result.copy,
        title: result.titleOk ? result.copy.title : fallback.title,
        metaDescription: result.metaOk ? result.copy.metaDescription : fallback.metaDescription,
        intro: result.copy.intro.length ? result.copy.intro : fallback.intro,
        sections: result.copy.sections.length >= 2 ? result.copy.sections : fallback.sections,
        faq: result.copy.faq.length ? result.copy.faq : fallback.faq,
      }
      return { copy, review: { mode: 'ai', provider: name, checkedClaims: result.checked, rejected: result.rejected } }
    }
    catch (error) {
      console.warn(`[copywriter] ${name} failed, trying next option:`, (error as Error).message)
    }
  }

  // No provider configured or all failed: publish the data-led copy rather than nothing
  return { copy: fallback, review: { mode: 'data', provider: providers.length ? 'fallback' : 'none', checkedClaims: 0, rejected: [] } }
}
