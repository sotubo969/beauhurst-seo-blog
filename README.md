# AI-powered SEO blog generator (Nuxt)

Upload a ranked company CSV from any industry and get a server-rendered, SEO-optimised blog page with a ranking table, statistics and AI-written copy. You don't need to rebuild or redeploy anything.

The UK fintech top 100 is included as the first blog (`samples/uk-fintech-top-100.csv`).

## Quick start

```bash
npm install
cp .env.example .env        # add a free Gemini key from https://aistudio.google.com/apikey
npm run dev                 # http://localhost:3000
```

Go to **/upload**, choose a CSV, and you're redirected to the new blog page when it's ready.

No API key? The workflow still runs. It falls back to Ollama if `NUXT_OLLAMA_MODEL` is set (e.g. `llama3.1`), or else to a rules-based template written from the same facts. The demo never stalls on a quota error.

## How it works

```
CSV upload ─► parse (Papa Parse) ─► detect columns ─► rank + compute stats ─► LLM writes copy ─► save JSON ─► /blog/[slug] (SSR)
```

1. **Column detection** (`server/utils/dataset.ts`). Nothing is hardcoded for fintech. Each column gets a role from its header name first and the shape of its values second:
   - **rank** / **name**: `Rank`, `Company`, `Organisation`…
   - **value**: a numeric money-like column such as `Total Raised`, `Revenue` or `Valuation`. Understands `£1,234`, `$1.2m`, `€3bn`.
   - **category**: low-variety columns such as `Region`, `Stage` or `Employees`, which become breakdown charts.
   - **tags**: semicolon- or pipe-separated lists such as `Industries`, which become sub-sector counts.
   - **description** and **url**: shown in the table.

   If there's no rank column, rows are ranked by the value column.
2. **Statistics** are calculated in code, never by the LLM: total, mean, median, top and bottom, top-10 share, a breakdown per category, and the most common tags.
3. **Copy generation** (`server/utils/copywriter.ts`). Those statistics and the top 10 rows go into a prompt that asks for strict JSON: title, meta description, intro, H2 sections, FAQ and keywords. The model is told to use only the supplied numbers, which keeps hallucination down. The response is validated, and any missing or malformed field is filled from the template, so a bad LLM response can't break the page. Providers are tried in order: Gemini models (comma-separated in `NUXT_GEMINI_MODEL`, so Flash-Lite can take over if the free Flash quota runs out), then Ollama, then the template.
4. **Storage**. Each blog is one JSON file in `data/blogs/`, saved through Nitro's storage layer. Pages read from storage on each request, so a new upload is live straight away. Swapping the `fs` driver for Redis, S3 or a database is a one-line config change.
5. **One template** (`app/pages/blog/[slug].vue`) renders every blog.

## SEO

- Server-side rendering. The full article and all ranking rows are in the initial HTML.
- One H1, keyword-led H2s, a table of contents with anchor links, and FAQ content.
- `<title>`, meta description, keywords, canonical URL, Open Graph and Twitter tags, plus `lang="en-GB"`.
- JSON-LD structured data: `Article`, `ItemList` (the ranking), `BreadcrumbList` and `FAQPage`.
- A dynamic `/sitemap.xml` that includes every generated blog, and a `/robots.txt` (the upload page is also `noindex`).
- Semantic table markup (`scope`, row headers) and outbound company links marked `rel="nofollow noopener"`.
- Fast pages: no UI framework and CSS-only charts. It's responsive down to mobile, where the table scrolls horizontally.

## Project structure

```
app/pages/index.vue          blog listing
app/pages/upload.vue         CSV upload UI
app/pages/blog/[slug].vue    the reusable blog template (SEO meta + JSON-LD)
app/components/              RankingTable, BarChart, StatCards
server/api/generate.post.ts  upload -> parse -> stats -> LLM -> save
server/api/blogs/            list / fetch blogs
server/routes/               sitemap.xml, robots.txt
server/utils/                dataset analysis, copywriter (LLM), storage
shared/                      types and formatting used by both client and server
```

## Tools used

- **Nuxt 4** (Vue 3, Nitro), for SSR, API routes and storage
- **Papa Parse**, for CSV parsing
- **Google Gemini API** (free tier), for copy generation, with **Ollama** as a local alternative

## Configuration

| Variable | Purpose |
| --- | --- |
| `NUXT_GEMINI_API_KEY` | Gemini API key (free from AI Studio) |
| `NUXT_GEMINI_MODEL` | Comma-separated models to try in order |
| `NUXT_OLLAMA_HOST` / `NUXT_OLLAMA_MODEL` | Optional local LLM |
| `NUXT_PUBLIC_SITE_URL` | Base URL for canonical links, OG tags and the sitemap |

## Limitations and next steps

- There's no authentication on `/upload`. In production it would sit behind a login.
- Generated copy is published straight away. A review or "draft" step before publishing would be sensible.
- The `fs` storage needs a persistent disk. On serverless hosting, switch the Nitro storage driver.
- Possible additions: an OG image per blog, editing or regenerating a blog's copy, and related-blog links between industries.
