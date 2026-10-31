import type { BlogCopy, ColumnInfo, DatasetStats } from '~~/shared/types'
import { formatMoney, formatPercent } from '~~/shared/format'
import { columnFor } from './dataset'

interface CopyInput {
  industry: string
  columns: ColumnInfo[]
  rows: Record<string, string>[]
  stats: DatasetStats
}

/** Plain-language facts derived from the data. Both the LLM prompt and the template use these. */
export function buildFacts({ industry, columns, rows, stats }: CopyInput) {
  const money = (n: number) => formatMoney(n, stats.currency)
  const nameKey = columnFor(columns, 'name')
  const descKey = columnFor(columns, 'description')
  const facts: string[] = [`Dataset: top ${stats.count} ${industry} companies.`]

  if (stats.valueColumn) {
    facts.push(
      `Ranked by "${stats.valueColumn}". Combined total: ${money(stats.total)}.`,
      `Average: ${money(stats.mean)}. Median: ${money(stats.median)}.`,
      `Largest: ${stats.top!.name} with ${money(stats.top!.value)}. Smallest in the list: ${stats.bottom!.name} with ${money(stats.bottom!.value)}.`,
      `The top 10 account for ${money(stats.top10Total)}, or ${formatPercent(stats.top10Share)} of the total.`,
    )
  }

  for (const b of stats.breakdowns) {
    const leaders = [...b.items].sort((x, y) => y.count - x.count).slice(0, 4)
    facts.push(`By ${b.column}: ${leaders.map(i => `${i.label} ${i.count} (${formatPercent(i.share)})`).join(', ')}.`)
  }

  if (stats.tags?.items.length) {
    facts.push(`Most common ${stats.tags.column}: ${stats.tags.items.slice(0, 6).map(t => `${t.label} (${t.count})`).join(', ')}.`)
  }

  const leaders = rows.slice(0, 10).map((row, i) => {
    const value = stats.valueColumn ? ` – ${row[stats.valueColumn]}` : ''
    const desc = descKey && row[descKey] ? `: ${row[descKey]}` : ''
    return `${i + 1}. ${nameKey ? row[nameKey] : 'Unnamed'}${value}${desc}`
  })

  return { facts, leaders }
}

function buildPrompt(input: CopyInput) {
  const { facts, leaders } = buildFacts(input)
  const year = new Date().getFullYear()

  return `You are an SEO copywriter for Beauhurst, a UK platform for data on private companies.
Write a blog post about the dataset below. Use UK English. Only use numbers and company names
given here: do not invent figures, dates or claims. Do not repeat the full ranking (a table is shown separately).

FACTS
${facts.join('\n')}

TOP 10
${leaders.join('\n')}

Return JSON only, with exactly this shape:
{
  "title": "H1 under 65 characters including the main keyword, e.g. 'Top ${input.stats.count} ${input.industry} Companies in ${year}'",
  "metaDescription": "140-155 characters, includes the main keyword and a reason to click",
  "intro": ["2 short paragraphs introducing the list and why it matters"],
  "sections": [{ "heading": "H2 with a relevant keyword", "paragraphs": ["1-3 paragraphs"] }],
  "faq": [{ "question": "a question people search for", "answer": "1-2 sentence answer from the facts" }],
  "keywords": ["5-8 search keywords"]
}
Write 4 or 5 sections covering: the leaders, concentration of value, the breakdowns
(location, stage, size or sector, whichever the facts include), and what it means for the
sector. Write 3 or 4 FAQ items.`
}

async function callGemini(prompt: string, apiKey: string, model: string) {
  const res = await $fetch<any>(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey },
    body: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
    },
    timeout: 60_000,
  })
  return res.candidates?.[0]?.content?.parts?.[0]?.text as string
}

async function callOllama(prompt: string, host: string, model: string) {
  const res = await $fetch<{ response: string }>(`${host.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    body: { model, prompt, format: 'json', stream: false },
    timeout: 180_000,
  })
  return res.response
}

/** Copy written without an LLM, so the workflow still works offline or when the free quota runs out. */
export function templateCopy(input: CopyInput): BlogCopy {
  const { industry, stats } = input
  const money = (n: number) => formatMoney(n, stats.currency)
  const year = new Date().getFullYear()
  const metric = stats.valueColumn?.toLowerCase() ?? 'size'
  const sections: BlogCopy['sections'] = []

  if (stats.top) {
    sections.push({
      heading: `The leading ${industry} companies`,
      paragraphs: [
        `${stats.top.name} tops the ranking with ${money(stats.top.value)} in ${metric}. Across all ${stats.count} companies the combined figure is ${money(stats.total)}, an average of ${money(stats.mean)} each and a median of ${money(stats.median)}.`,
      ],
    })
    sections.push({
      heading: `How concentrated is ${metric} across the ${industry} ranking?`,
      paragraphs: [
        `The ten highest-ranked companies account for ${money(stats.top10Total)}, or ${formatPercent(stats.top10Share)} of the total. ${stats.mean > stats.median * 1.2 ? 'The average sits well above the median, which shows that a few large companies pull the figures up.' : 'The average and median are close, so value is spread fairly evenly across the list.'}`,
      ],
    })
  }

  for (const b of stats.breakdowns) {
    const lead = [...b.items].sort((x, y) => y.count - x.count)[0]!
    sections.push({
      heading: `${industry} companies by ${b.column.toLowerCase()}`,
      paragraphs: [`${lead.label} is the most common ${b.column.toLowerCase()}, with ${lead.count} of the ${stats.count} companies (${formatPercent(lead.share)}).`],
    })
  }

  if (stats.tags?.items.length) {
    const [first, second] = stats.tags.items
    sections.push({
      heading: `Popular ${industry} sub-sectors`,
      paragraphs: [`${first!.label} is the most common classification, appearing for ${first!.count} companies${second ? `, followed by ${second.label} (${second.count})` : ''}.`],
    })
  }

  return {
    title: `Top ${stats.count} ${industry} Companies in ${year}`,
    metaDescription: `Discover the top ${stats.count} ${industry} companies in ${year}${stats.top ? `, led by ${stats.top.name}` : ''}. Full ranking table, key statistics and insights.`.slice(0, 158),
    intro: [
      `This is our ranking of the top ${stats.count} ${industry} companies${stats.valueColumn ? `, ordered by ${metric}` : ''}. Use it to find the businesses leading the sector and to see where activity is concentrated.`,
    ],
    sections,
    faq: stats.top
      ? [
          { question: `What is the largest ${industry} company in the list?`, answer: `${stats.top.name} ranks first with ${money(stats.top.value)} in ${metric}.` },
          { question: `How much have the top ${stats.count} ${industry} companies raised in total?`, answer: `Together they account for ${money(stats.total)}, with a median of ${money(stats.median)} per company.` },
        ]
      : [],
    keywords: [`${industry} companies`, `top ${industry} companies`, `${industry} ranking ${year}`],
  }
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const textList = (v: unknown) => (Array.isArray(v) ? v.filter(isText) : [])

/** Keeps whatever the model got right and fills any gaps from the template. */
function mergeCopy(raw: any, fallback: BlogCopy): BlogCopy {
  const sections = Array.isArray(raw?.sections)
    ? raw.sections
        .filter((s: any) => isText(s?.heading))
        .map((s: any) => ({ heading: s.heading, paragraphs: textList(s.paragraphs) }))
        .filter((s: BlogCopy['sections'][number]) => s.paragraphs.length)
    : []
  const faq = Array.isArray(raw?.faq) ? raw.faq.filter((f: any) => isText(f?.question) && isText(f?.answer)) : []

  return {
    title: isText(raw?.title) ? raw.title : fallback.title,
    metaDescription: isText(raw?.metaDescription) ? raw.metaDescription.slice(0, 160) : fallback.metaDescription,
    intro: textList(raw?.intro).length ? textList(raw.intro) : fallback.intro,
    sections: sections.length ? sections : fallback.sections,
    faq: faq.length ? faq : fallback.faq,
    keywords: textList(raw?.keywords).length ? textList(raw.keywords) : fallback.keywords,
  }
}

export async function writeCopy(input: CopyInput): Promise<{ copy: BlogCopy, generatedBy: string }> {
  const config = useRuntimeConfig()
  const fallback = templateCopy(input)
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
      const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''))
      return { copy: mergeCopy(json, fallback), generatedBy: name }
    }
    catch (error) {
      console.warn(`[copywriter] ${name} failed, trying next option:`, (error as Error).message)
    }
  }

  return { copy: fallback, generatedBy: 'template' }
}
