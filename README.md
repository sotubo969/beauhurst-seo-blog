# Data-led SEO ranking generator (Nuxt)

Upload a ranked company CSV from any sector and publish a server-rendered, SEO-optimised ranking article in seconds. You don't need to rebuild or redeploy anything.

The design principle is **data first, AI second**. Every number, chart, table and key finding is calculated in code from the dataset. A language model is optional: it only rewrites the narrative, and its output is fact-checked against the data before it's published.

The UK fintech top 100 is included as the first article (`samples/uk-fintech-top-100.csv`).

## Quick start

```bash
npm install
cp .env.example .env        # optional: add a free Gemini key from https://aistudio.google.com/apikey
npm run dev                 # http://localhost:3000
npm test                    # unit tests
```

Open **/upload** and follow the three steps:
1. Upload a CSV.
2. Check the detected column mapping.
3. Choose a narrative mode and generate.

## How it works

```
CSV ─► parse ─► detect column roles ─► user confirms mapping ─► rank ─► statistics ─► key findings
                                                                                         │
                     ┌───────────────────────── narrative ───────────────────────────────┤
                     │  Data-only: rules-based editorial copy                            │
                     │  AI-assisted: LLM drafts prose ─► fact-check ─► fill gaps          │
                     └──────────────────────────────────────────────────────────────────►┴─► save JSON ─► /blog/[slug] (SSR)
```

### 1. Column detection (`server/utils/dataset.ts`)
Nothing is hardcoded for fintech. Each column gets a role from its header name first and the shape of its values second:
- rank and name
- a numeric value column (understands `£1,234`, `$1.2m`, `€3bn`)
- low-variety categories (region, stage, size band), which get charts and breakdown tables
- semicolon- or pipe-separated tags (sub-sectors)
- descriptions and websites

The upload screen shows the detected mapping with sample values, so a user can correct it before generating. If the CSV has no rank column, rows are ranked by the value column.

### 2. Statistics (`server/utils/dataset.ts`)
These are calculated in code, never by the LLM:
- total, mean and median
- top-10 share
- a **Gini coefficient** for concentration
- a value distribution in readable bands (1 / 2.5 / 5 scale)
- for every category and tag: the company count, share of companies, share of value, average value and highest-ranked company

### 3. Key findings (`server/utils/insights.ts`)
A rules engine turns the statistics into ranked, plain-English findings. For example, "the top 10 hold 33% of the combined total raised, 3.3x an even split", or "the 5 companies in South West average £10.0m against £6.2m overall". Findings only appear when the data supports them, using thresholds for group size and difference from the mean.

### 4. Narrative (`server/utils/copywriter.ts`)
- **Data-only mode** writes the whole article (title, meta description, intro, H2 sections, FAQ and keywords) from templates driven by the statistics. It's deterministic, instant and needs no external services.
- **AI-assisted mode** sends the verified findings to an LLM and asks it to write prose only, returned as strict JSON. The prompt forbids calculating or inventing figures. Providers are tried in order: Gemini models (comma-separated, so Flash-Lite takes over if the free Flash quota runs out), then Ollama.

### 5. Fact-checking (`server/utils/factcheck.ts`)
Every figure in the LLM draft (`£30.3m`, `78%`, `15.2x`…) is extracted and matched against all numbers derivable from the dataset, with a small tolerance for rounding.
- Any paragraph or FAQ containing an unverifiable figure is removed.
- A failing title or meta description falls back to the data-led version.
- If the model fails or returns bad JSON, the data-led copy is published instead.

The methodology section of each article reports how many passages were checked and how many were removed.

### 6. Storage and rendering
Each article is one JSON file in `data/blogs/`, saved through Nitro storage, so swapping to Redis, S3 or a database is a config change. A single template (`app/pages/blog/[slug].vue`) renders every article on request, which is why new uploads are live straight away.

## SEO

- **Server-side rendering.** The article, findings, charts and all ranking rows are in the initial HTML.
- **Content structure.** One H1, keyword-led H2s, a sticky table of contents with anchor links, and a FAQ section.
- **Meta tags.** Title, meta description, keywords, canonical URL, Open Graph, Twitter and article tags, plus `lang="en-GB"`.
- **Structured data (JSON-LD).** `Article`, `ItemList` (the full ranking), `Dataset`, `BreadcrumbList` and `FAQPage`.
- **Crawling.** A dynamic `/sitemap.xml` covers every article. `/robots.txt` blocks the upload page and the API, and the upload page is also `noindex`. Unknown articles return a real 404.
- **Accessibility.** Semantic tables (captions, `scope`, `aria-sort`), accessible SVG charts (`role="img"` with a text description), a skip link, visible focus states and reduced-motion support.
- **Performance.** No UI framework: charts are SVG and CSS. Search, column sorting and CSV download run on the client without changing the server-rendered order.

## Project structure

```
app/pages/index.vue            article listing
app/pages/upload.vue           3-step upload: file -> column mapping -> settings
app/pages/blog/[slug].vue      the reusable article template (SEO meta + JSON-LD)
app/components/                RankingTable, LeaderChart, BarChart, GroupTable, InsightCards, StatCards
server/api/preview.post.ts     detect columns and return sample rows
server/api/generate.post.ts    parse -> rank -> stats -> findings -> narrative -> save
server/utils/dataset.ts        parsing, column detection, ranking, statistics
server/utils/insights.ts       rules-based key findings
server/utils/copywriter.ts     data-led copy, LLM prompt and providers
server/utils/factcheck.ts      verifies every figure in LLM output
server/routes/                 sitemap.xml, robots.txt
tests/                         Vitest unit tests for analysis, findings and fact-checking
```

## Tools used

- **Nuxt 4** (Vue 3, Nitro), for SSR, API routes and storage
- **Papa Parse**, for CSV parsing (server) and CSV export (client)
- **Google Gemini API** (free tier) or **Ollama**, both optional, for narrative drafting
- **Vitest**, for unit tests

## Configuration

| Variable | Purpose |
| --- | --- |
| `NUXT_GEMINI_API_KEY` | Gemini API key (free from AI Studio). Optional. |
| `NUXT_GEMINI_MODEL` | Comma-separated models to try in order |
| `NUXT_OLLAMA_HOST` / `NUXT_OLLAMA_MODEL` | Optional local LLM |
| `NUXT_PUBLIC_SITE_URL` | Base URL for canonical links, OG tags and the sitemap |

## Limitations and next steps

- `/upload` has no authentication. In production it would sit behind a login, with a draft and review step before publishing.
- `fs` storage needs a persistent disk. Serverless hosting would need a different Nitro storage driver.
- Possible additions:
  - generated OG images per article
  - comparing a sector over time when a newer dataset is uploaded
  - internal links between related sectors
