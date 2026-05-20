import { startStandalone, wrap } from 'locize'

// Client-only plugin (note the `.client.ts` suffix). Two jobs:
//
// 1. **saveMissing** — when a translation key is requested but the loaded
//    JSON doesn't contain it, POST it to the Locize "missing" endpoint so
//    translators see new keys appear in the Locize UI without a manual
//    extract step. Dev-only; production builds never ship the write-
//    enabled apiKey.
//
// 2. **InContext editor** — when the page is loaded with `?incontext=true`
//    (or rendered inside the Locize editor iframe), start the locize popup
//    UI and wrap every t() output with `i18next-subliminal` invisible
//    markers so the editor can map clicks back to the right translation
//    key. The `start()` routine inside the locize package handles the
//    popup mount + postMessage handshake with the editor iframe; we only
//    have to supply the framework-specific implementation surface
//    (getResource / setResource / getLng / etc.) since the package ships
//    with an i18next implementation, not a vue-i18n one.

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

  // Reach into the global composer. `$i18n` on `nuxtApp` is the @nuxtjs/i18n
  // wrapper; the underlying vue-i18n composer lives on `.global` in
  // composition-API mode (which we use — `legacy: false` in i18n.config.ts).
  const i18n = (nuxtApp.$i18n as any)

  // Trigger a vue-i18n re-render by re-assigning the current locale's
  // messages object back to itself. This nudges Vue's reactivity into
  // re-evaluating every t() output — necessary because vue-i18n
  // memoises t() results, so handlers set *after* the initial
  // hydration render (like the ones we're about to attach) only kick
  // in when something else triggers a re-render.
  const triggerRerender = () => {
    const cur = i18n.locale.value
    i18n.setLocaleMessage(cur, { ...(i18n.getLocaleMessage(cur) || {}) })
  }

  // ─── saveMissing ──────────────────────────────────────────────────
  // Wire the missing handler on the vue-i18n composer so any t() call
  // that hits a missing key gets POSTed to Locize. The composer's `missing`
  // property is settable at runtime in vue-i18n 9+.
  if (!isProduction && apiKey) {
    const pending = new Set<string>()
    i18n.missing = (locale: string, key: string) => {
      // vue-i18n delivers the dotted path as a single string ("index.title");
      // the first segment is the namespace, rest is the actual key.
      const dot = key.indexOf('.')
      const ns = dot >= 0 ? key.slice(0, dot) : 'common'
      const actualKey = dot >= 0 ? key.slice(dot + 1) : key
      const dedupeKey = `${locale}/${ns}/${actualKey}`
      if (pending.has(dedupeKey)) return
      pending.add(dedupeKey)

      fetch(`${cdnHost}/missing/${projectId}/${version}/${locale}/${ns}`, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [actualKey]: actualKey }),
      }).catch(() => { pending.delete(dedupeKey) })
    }
    // Re-evaluate every t() so cached outputs that should have triggered
    // `missing` during hydration get a second chance now that the
    // handler is wired up.
    triggerRerender()
  }

  // ─── InContext editor ─────────────────────────────────────────────
  // Bail unless we're either inside the editor iframe or the user opted
  // in via `?incontext=true`.
  if (!isInIframe && !showInContext) return

  // Wrap every translation with subliminal markers so the locize editor
  // can pick the right key when the user clicks a string on the page.
  // The wrap-function is a no-op for non-string values (e.g. arrays
  // returned by vue-i18n's tm() helper); we still guard against that.
  const originalPostTranslation = i18n.postTranslation
  i18n.postTranslation = (translated: any, key: string) => {
    if (typeof translated === 'string') {
      // Split the dotted key into namespace + actual key so the editor's
      // selectKey handler can resolve clicks back to the right
      // namespace + entry. First segment is treated as the namespace.
      const dot = key.indexOf('.')
      const ns = dot >= 0 ? key.slice(0, dot) : 'common'
      const actualKey = dot >= 0 ? key.slice(dot + 1) : key
      try {
        return wrap(translated, { key: actualKey, ns, lng: i18n.locale.value })
      } catch { /* swallow */ }
    }
    return typeof originalPostTranslation === 'function'
      ? originalPostTranslation(translated, key)
      : translated
  }

  // Implementation surface that `locize`'s `start()` routine expects.
  // Mirrors `src/implementations/i18nextImplementation.js` from the
  // locize package, ported to vue-i18n's composer API.
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
      cb: (lng: string, ns: string, key: string, value: any) => void,
    ) => {
      const orig = i18n.missing
      i18n.missing = (locale: string, key: string, vm: any, values: any) => {
        const dot = key.indexOf('.')
        const ns = dot >= 0 ? key.slice(0, dot) : 'common'
        const actualKey = dot >= 0 ? key.slice(dot + 1) : key
        cb(locale, ns, actualKey, '')
        if (typeof orig === 'function') return orig(locale, key, vm, values)
      }
    },
    triggerRerender,
  }

  // Force a re-render BEFORE starting the editor's DOM observer. The
  // initial hydration rendered t() outputs without subliminal markers
  // (we hadn't set postTranslation yet). Re-evaluating now writes the
  // wrapped strings into the DOM, which is what the editor's
  // MutationObserver-backed parser will then see — populating the
  // segments list in the popup. Without this kick, the popup mounts
  // empty and no DOM changes ever happen to trigger the parser.
  triggerRerender()

  startStandalone({ implementation: impl, show: true })
})
