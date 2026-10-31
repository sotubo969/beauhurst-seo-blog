import type { Blog } from '~~/shared/types'
import { slugify } from '~~/shared/format'

const MAX_BYTES = 2 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file')
  const industryField = form?.find(part => part.name === 'industry')?.data.toString().trim()

  if (!file?.data.length) throw createError({ statusCode: 400, statusMessage: 'Please upload a CSV file.' })
  if (file.data.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'CSV must be under 2 MB.' })

  let parsed
  try {
    parsed = parseCsv(file.data.toString('utf8'))
  }
  catch (error) {
    throw createError({ statusCode: 422, statusMessage: (error as Error).message })
  }

  const columns = detectColumns(parsed.headers, parsed.rows)
  if (!columnFor(columns, 'name')) {
    throw createError({ statusCode: 422, statusMessage: 'Could not find a company name column in the CSV.' })
  }

  const rows = rankRows(columns, parsed.rows)
  const stats = computeStats(columns, rows)
  const industry = industryField || industryFromFilename(file.filename) || 'UK'
  const { copy, generatedBy } = await writeCopy({ industry, columns, rows, stats })

  const blog: Blog = {
    slug: await uniqueSlug(slugify(copy.title) || 'blog'),
    industry,
    createdAt: new Date().toISOString(),
    sourceFile: file.filename ?? 'upload.csv',
    generatedBy,
    columns,
    rows,
    stats,
    copy,
  }

  await saveBlog(blog)
  return { slug: blog.slug, title: copy.title, generatedBy }
})

function industryFromFilename(name?: string) {
  return name
    ?.replace(/\.csv$/i, '')
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
