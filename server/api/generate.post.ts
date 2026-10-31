import type { Blog } from '~~/shared/types'
import { slugify } from '~~/shared/format'

export default defineEventHandler(async (event) => {
  const { headers, rows: rawRows, filename, field } = await readCsvUpload(event)

  let overrides: Record<string, string> | undefined
  try {
    overrides = field('roles') ? JSON.parse(field('roles')!) : undefined
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Column roles were not valid JSON.' })
  }

  const detected = applyRoleOverrides(detectColumns(headers, rawRows), overrides)
  if (!columnFor(detected, 'name')) {
    throw createError({ statusCode: 422, statusMessage: 'Choose which column holds the company name.' })
  }

  const { columns, rows } = rankRows(detected, rawRows)
  const visibleColumns = columns.filter(c => c.role !== 'ignore')
  const industry = field('industry') || industryFromFilename(filename) || 'UK'
  const stats = computeStats(visibleColumns, rows)
  const insights = buildInsights(stats, industry)
  const mode = field('mode') === 'data' ? 'data' : 'ai'
  const { copy, review } = await writeCopy({ industry, columns: visibleColumns, rows, stats, insights }, mode)

  const blog: Blog = {
    slug: await uniqueSlug(slugify(copy.title) || 'blog'),
    industry,
    createdAt: new Date().toISOString(),
    sourceFile: filename,
    columns: visibleColumns,
    rows,
    stats,
    insights,
    copy,
    review,
  }

  await saveBlog(blog)
  return { slug: blog.slug, title: copy.title, review }
})

function industryFromFilename(name: string) {
  return name
    .replace(/\.csv$/i, '')
    .replace(/\b(top|uk|\d+|companies|data(set)?|list|ranking)\b/gi, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function uniqueSlug(base: string) {
  let slug = base
  for (let i = 2; await blogExists(slug); i++) slug = `${base}-${i}`
  return slug
}
