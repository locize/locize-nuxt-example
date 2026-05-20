import { startStandalone } from 'locize'
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
//    `?incontext=true` (or rendered inside the Locize editor iframe).
//    `startStandalone()` mounts the popup + sets up the postMessage
//    handshake with the editor iframe; it expects a framework-specific
//    "implementation" surface (get/set resources, get current language,
//    bind language-change events, etc.) since the locize package ships
//    an i18next implementation but not a vue-i18n one. We provide that
//    surface inline by adapting the vue-i18n composer API.

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
  const showInContext =
    new URLSearchParams(window.location.search).get('incontext') === 'true'

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

  // Reach the global vue-i18n composer for the InContext editor's
  // implementation surface. With `legacy: false` + @nuxtjs/i18n 10.x,
  // `nuxtApp.$i18n` IS the global composer.
  const i18n = (nuxtApp.$i18n as any)

  // ─── (2) InContext editor — only when active ──────────────────────
  if (!locizeRuntime.isInContext) return

  // The locize package's `start()` expects a framework-specific impl
  // surface. Mirrors `src/implementations/i18nextImplementation.js`
  // from the locize package, ported to vue-i18n's composer API.
  const impl = {
    getResource: (lng: string, ns: string, key: string) => {
      const msgs = (i18n.getLocaleMessage(lng) || {}) as Record<string, any>
      return msgs[ns]?.[key]
    },
    setResource: (lng: string, ns: string, key: string, value: any) => {
      i18n.mergeLocaleMessage(lng, { [ns]: { [key]: value } })
    },
    getResourceBundle: (lng: string, ns: string, cb: (data: any) => void) => {
      const msgs = (i18n.getLocaleMessage(lng) || {}) as Record<string, any>
      cb(msgs[ns] || {})
    },
    getDefaultNS: () => 'common',
    getLng: () => i18n.locale.value,
    getSourceLng: () => 'en',
    getLocizeDetails: () => ({
      projectId,
      version,
      backendName: 'locize-cli',
      sourceLng: 'en',
      i18nFormat: 'vuei18n',
      i18nFramework: 'vue-i18n',
      defaultNS: 'common',
      ns: ['common', 'index', 'second'],
      targetLngs: ((i18n.availableLocales as string[]) || []).filter(
        (l) => l !== 'en',
      ),
    }),
    bindLanguageChange: (cb: (lng: string) => void) => {
      watch(() => i18n.locale.value, (lng) => cb(lng as string))
    },
    bindMissingKeyHandler: (
      _cb: (lng: string, ns: string, key: string, value: any) => void,
    ) => {
      // The actual missing-key handling lives in `i18n.config.ts`, which
      // POSTs to Locize directly. We deliberately don't forward those
      // events into the editor here — the round trip via the Locize
      // backend is the canonical path. Left as a stub so the editor's
      // wiring doesn't NPE on a missing handler.
    },
    triggerRerender: () => {
      // Re-assign the current locale messages object to itself to nudge
      // Vue's reactivity into re-evaluating every t() call. Used by the
      // editor after a save so the page picks up the edited string.
      const cur = i18n.locale.value
      i18n.setLocaleMessage(cur, { ...(i18n.getLocaleMessage(cur) || {}) })
    },
  }

  // Force one re-render BEFORE starting the editor, so vue-i18n
  // re-evaluates every t() output under the now-populated runtime
  // (postTranslation will wrap, missing will POST). Then start the
  // editor — its DOM observer picks up the wrapped strings as it runs
  // the initial parse + subsequent MutationObserver passes.
  impl.triggerRerender()

  startStandalone({ implementation: impl, show: true })
})
