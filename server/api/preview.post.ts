import type { DatasetPreview } from '~~/shared/types'

/** Returns the detected column roles and a few rows so the user can check them before generating. */
export default defineEventHandler(async (event): Promise<DatasetPreview> => {
  const { headers, rows } = await readCsvUpload(event)
  return {
    rowCount: rows.length,
    columns: detectColumns(headers, rows),
    sample: rows.slice(0, 5),
  }
})
