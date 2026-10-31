export default defineEventHandler((event) => {
  const site = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
  setHeader(event, 'content-type', 'text/plain')
  return `User-agent: *\nDisallow: /upload\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`
})
