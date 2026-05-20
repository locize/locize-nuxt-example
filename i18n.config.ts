// vue-i18n options consumed by @nuxtjs/i18n. Loaded on both server and
// client; keep this file pure (no Nuxt composables outside defineI18nConfig
// itself, no runtime side effects).
//
// `missing` is intentionally NOT set here — the saveMissing flow runs only
// on the client and only in dev, so it's wired in
// `app/plugins/locize.client.ts` where we have access to runtime config
// and can guard on `import.meta.dev`.

export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'en',
  // Surface missing translations during dev so saveMissing has something
  // to push. Production keeps the default "log to console" off.
  missingWarn: false,
  fallbackWarn: false,
}))
