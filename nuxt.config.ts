export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'en-GB' },
      meta: [{ name: 'theme-color', content: '#1e3a8a' }],
      link: [
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap' },
      ],
    },
  },

  runtimeConfig: {
    // Set with NUXT_GEMINI_API_KEY etc. (see .env.example)
    geminiApiKey: '',
    geminiModel: 'gemini-flash-latest,gemini-flash-lite-latest',
    ollamaHost: 'http://localhost:11434',
    ollamaModel: '',
    public: {
      siteUrl: 'http://localhost:3000',
      siteName: 'Beauhurst Insights',
    },
  },

  nitro: {
    storage: {
      blogs: { driver: 'fs', base: './data/blogs' },
    },
  },
})
