// vue-i18n options consumed by @nuxtjs/i18n. Loaded at vue-i18n init time
// on both server and client — handlers below check `import.meta.client`
// and the populated state in `app/utils/locize-runtime.ts` before doing
// anything, so they're safe to run during SSR.
//
// Why register `missing` + `postTranslation` here instead of in the
// `locize.client.ts` plugin? Because vue-i18n stores these per Composer
// at creation time. Assigning them post-init via `i18n.missing = fn` is
// silently a no-op against the global Composer in @nuxtjs/i18n 10.x —
// the t() call path resolves handlers captured at create time. Setting
// them through `defineI18nConfig()` ensures they're on the Composer
// from the first t() call.
import { wrap } from 'locize'
import { locizeRuntime } from './app/utils/locize-runtime'

// In-flight POSTs are deduplicated so a single missing key doesn't
// generate one POST per affected render frame. Reset after the request
// settles.
const pendingMissing = new Set<string>()

export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,

  // saveMissing — fires when `t('any.unknown.key')` doesn't resolve.
  // Pushes the key to Locize so it appears in the project UI without a
  // manual extract step.
  missing: (locale: string, key: string) => {
    if (!import.meta.client) return
    if (!locizeRuntime.saveMissing || !locizeRuntime.apiKey) return

    // vue-i18n delivers a dotted path ("index.title"); first segment is
    // the namespace, rest is the actual key.
    const dot = key.indexOf('.')
    const ns = dot >= 0 ? key.slice(0, dot) : 'common'
    const actualKey = dot >= 0 ? key.slice(dot + 1) : key
    const dedupe = `${locale}/${ns}/${actualKey}`
    if (pendingMissing.has(dedupe)) return
    pendingMissing.add(dedupe)

    fetch(
      `${locizeRuntime.cdnHost}/missing/${locizeRuntime.projectId}/${locizeRuntime.version}/${locale}/${ns}`,
      {
        method: 'POST',
        headers: {
          Authorization: locizeRuntime.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [actualKey]: actualKey }),
      },
    ).finally(() => pendingMissing.delete(dedupe))
  },

  // Wrap each translation with i18next-subliminal invisible markers
  // when the InContext editor is active, so the editor's parser can
  // resolve user clicks back to the right (ns, key) pair.
  postTranslation: (translated: unknown, key: string) => {
    if (!import.meta.client) return translated
    if (!locizeRuntime.isInContext) return translated
    if (typeof translated !== 'string') return translated

    const dot = key.indexOf('.')
    const ns = dot >= 0 ? key.slice(0, dot) : 'common'
    const actualKey = dot >= 0 ? key.slice(dot + 1) : key
    try {
      return wrap(translated, { key: actualKey, ns })
    } catch {
      return translated
    }
  },
}))
