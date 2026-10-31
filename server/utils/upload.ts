import type { H3Event } from 'h3'

const MAX_BYTES = 2 * 1024 * 1024

/** Reads the multipart upload and parses the CSV, turning any problem into a clear 4xx error. */
export async function readCsvUpload(event: H3Event) {
  const form = await readMultipartFormData(event)
  const field = (name: string) => form?.find(part => part.name === name)?.data.toString('utf8').trim()
  const file = form?.find(part => part.name === 'file')

  if (!file?.data.length) throw createError({ statusCode: 400, statusMessage: 'Please upload a CSV file.' })
  if (file.data.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'CSV must be under 2 MB.' })

  try {
    return { ...parseCsv(file.data.toString('utf8')), filename: file.filename ?? 'upload.csv', field }
  }
  catch (error) {
    throw createError({ statusCode: 422, statusMessage: (error as Error).message })
  }
}
