export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'en-GB' },
      link: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
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
