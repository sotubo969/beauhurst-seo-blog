export default defineEventHandler(async (event) => {
  const blog = await getBlog(getRouterParam(event, 'slug')!)
  if (!blog) throw createError({ statusCode: 404, statusMessage: 'Blog not found' })
  return blog
})
