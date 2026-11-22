import { watch } from 'vue'
import { startStandalone, getVueI18nImplementation, isInContextRequested } from 'locize'
import { locizeRuntime } from '~/utils/locize-runtime'

// Client-only plugin. Two jobs, in order:
//
// 1. **Populate `locizeRuntime`** from `runtimeConfig.public.*` and the
//    current URL so that the `missing` + `postTranslation` handlers
//    registered in `i18n.config.ts` (which run at vue-i18n init time
//    and don't have access to runtime config themselves) can start
//    doing real work on the next render cycle.
//
// 2. **Start the InContext editor** when the page is loaded with
//    `?incontext=true`, now or earlier in this browser tab (or rendered
//    inside the Locize editor iframe).
//    The vue-i18n implementation surface that `startStandalone()`
//    needs comes from `getVueI18nImplementation()` — ships in the
//    `locize` package alongside the i18next one, so we don't have to
//    inline a vue-i18n composer adapter here.

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const projectId = config.public.locizeProjectId as string
  const apiKey = config.public.locizeApiKey as string
  const version = config.public.locizeVersion as string
  const cdnType = config.public.locizeCdnType as 'standard' | 'pro'
  const cdnHost =
    cdnType === 'pro' ? 'https://api.locize.app' : 'https://api.lite.locize.app'

  const isProduction = !import.meta.dev
  const isInIframe = (() => {
    try { return self !== top } catch { return true }
  })()
  // the check the locize script uses itself: `?incontext=true` in the url now or earlier in this
  // browser tab, so a full page load keeps the editor; `?incontext=false` switches it off
  const showInContext = isInContextRequested()

  // ─── (1) populate shared runtime state ────────────────────────────
  locizeRuntime.projectId = projectId
  locizeRuntime.apiKey = apiKey
  locizeRuntime.version = version
  locizeRuntime.cdnHost = cdnHost
  locizeRuntime.isInContext = isInIframe || showInContext
  // Production builds with `NUXT_PUBLIC_LOCIZE_API_KEY=''` no-op the
  // POST loop in i18n.config.ts. In dev we want it on as long as we
  // have a write-enabled key.
  locizeRuntime.saveMissing = !isProduction && !!apiKey

  // Reach the global vue-i18n composer. With `legacy: false` +
  // @nuxtjs/i18n 10.x, `nuxtApp.$i18n` IS the global composer.
  const i18n = (nuxtApp.$i18n as any)

  // Force a re-render so vue-i18n re-evaluates every cached t() output
  // against the now-populated `locizeRuntime`. Without this, the
  // missing/postTranslation handlers fired once during hydration (with
  // empty runtime, so they correctly bailed) and never run again — Vue
  // has nothing to invalidate. Re-assigning the locale messages object
  // nudges reactivity into a full re-pass.
  //
  // Done outside the `?incontext` gate below because saveMissing wants
  // it too: without a re-render, missing keys discovered during
  // hydration never get POSTed to Locize.
  const forceRerender = () => {
    const cur = i18n.locale.value
    i18n.setLocaleMessage(cur, { ...(i18n.getLocaleMessage(cur) || {}) })
  }
  forceRerender()

  // ─── (2) InContext editor — only when active ──────────────────────
  if (!locizeRuntime.isInContext) return

  const impl = getVueI18nImplementation(i18n, {
    projectId,
    version,
    sourceLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'index', 'second'],
    targetLngs: ((i18n.availableLocales as string[]) || []),
    backendName: 'locize-cli',
    // Vue's `watch` enables the editor to observe locale changes so it
    // can re-fetch the right translations on language switch. Passing
    // it keeps the locize package framework-agnostic — without it,
    // bindLanguageChange is a no-op.
    watch,
  })

  // Force one re-render BEFORE starting the editor so vue-i18n's t()
  // outputs are wrapped with subliminal markers by the postTranslation
  // hook in `i18n.config.ts`. The editor's DOM observer will then pick
  // them up on the initial parse + subsequent mutation passes.
  //
  // Optional chaining because the `Implementation` interface in
  // `locize/index.d.ts` marks every method as optional — the runtime
  // path in `process.js` guards each call with `?.` itself, so a
  // partial implementation is legal. We supply all methods via
  // `getVueI18nImplementation`, so this is always safe in practice.
  impl.triggerRerender?.()

  startStandalone({ implementation: impl, show: true })
})
