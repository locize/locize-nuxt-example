// Shared runtime state for the Locize integration.
//
// `i18n.config.ts` runs at vue-i18n init time (before the Nuxt plugin
// graph fires) and is where `missing` + `postTranslation` get registered
// on the global vue-i18n composer. But it has no access to
// `useRuntimeConfig()` or the request URL. So we expose a mutable module
// here that `app/plugins/locize.client.ts` populates from runtime config
// + URL inspection once the plugin runs, and the handlers in
// `i18n.config.ts` read from it on each call.
//
// All fields are intentionally JS-default-empty so the handlers no-op
// safely until the plugin populates them.
export const locizeRuntime = {
  projectId: '',
  apiKey: '',
  version: 'latest',
  cdnHost: 'https://api.lite.locize.app',
  /** True when the InContext editor is on: `?incontext=true` now or earlier
   *  in this browser tab, or rendered inside the Locize editor iframe.
   *  Gates subliminal wrapping. */
  isInContext: false,
  /** Dev-only flag; gates saveMissing POSTs. */
  saveMissing: false,
}
