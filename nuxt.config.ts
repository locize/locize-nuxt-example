// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  compatibilityDate: '2026-05-20',

  modules: ['@nuxtjs/i18n'],

  // `@nuxtjs/i18n` configuration. Translations live under `i18n/locales/`
  // and are populated at build time by `locize download` (see the
  // `downloadLocales` script in package.json). Splitting each locale into
  // multiple namespace files (`common.json` / `index.json` / `second.json`)
  // mirrors the Locize project layout so namespaces round-trip cleanly
  // through `locize sync`.
  i18n: {
    defaultLocale: 'en',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.ts' },
      { code: 'de', language: 'de-DE', name: 'Deutsch', file: 'de.ts' },
    ],
    lazy: true,
  },

  // Locize CDN endpoint is used at runtime by the locize plugin for the
  // InContext editor — register it here as a runtime hint visible to
  // server + client plugins via `useRuntimeConfig().public.locize`.
  runtimeConfig: {
    public: {
      locizeProjectId: '24717bdc-b48a-4520-a702-88b7f45bcb0a',
      // Dev-only API key (for `saveMissing`). Empty in production builds —
      // override at deploy time via `NUXT_PUBLIC_LOCIZE_API_KEY=''`.
      locizeApiKey: 'lz_api_1AQjKuZRaLQlRQGqPEHWruvNtF1dN8F4',
      locizeVersion: 'latest',
      locizeCdnType: 'standard',
    },
  },
})
