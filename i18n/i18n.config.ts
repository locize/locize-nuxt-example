// vue-i18n options consumed by Nuxt I18n. Loaded at vue-i18n init time on
// both server and client — handlers below check `import.meta.client` and
// the populated state in `app/utils/locize-runtime.ts` before doing
// anything, so they're safe to run during SSR.
//
// File location matters: Nuxt I18n 10.x resolves this file's path
// relative to `layer.i18nDir` (the `i18n/` directory), not the project
// root. Putting it under `i18n/` is what gets it loaded.
//
// IMPORTANT — do NOT mention the literal name of the Nuxt I18n config
// macro anywhere in this file (including comments and string literals).
// Nuxt I18n's module post-processes any file containing that identifier
// with a greedy regex that matches the call site AND captures up to the
// final `)` in the file. With comments preserved by oxc-transform, a
// comment-text match yanks the closing paren of unrelated `console.log`
// / `fetch(...)` calls into the regex's capture group and corrupts the
// transformed output. Symptom: build error "Expected ')' but found ';'".
import { wrap } from 'locize'
import { locizeRuntime } from '../app/utils/locize-runtime'

const pendingMissing = new Set()

function handleMissing (locale, key) {
  // eslint-disable-next-line no-console
  console.log('[locize][missing handler] fired', {
    locale,
    key,
    isClient: import.meta.client,
    saveMissing: locizeRuntime.saveMissing,
    hasApiKey: !!locizeRuntime.apiKey,
  })
  if (!import.meta.client) return
  if (!locizeRuntime.saveMissing || !locizeRuntime.apiKey) return

  const dot = key.indexOf('.')
  const ns = dot >= 0 ? key.slice(0, dot) : 'common'
  const actualKey = dot >= 0 ? key.slice(dot + 1) : key
  const dedupe = locale + '/' + ns + '/' + actualKey
  if (pendingMissing.has(dedupe)) return
  pendingMissing.add(dedupe)

  const url = locizeRuntime.cdnHost + '/missing/' + locizeRuntime.projectId
    + '/' + locizeRuntime.version + '/' + locale + '/' + ns
  fetch(url, {
    method: 'POST',
    headers: {
      Authorization: locizeRuntime.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ [actualKey]: actualKey }),
  }).finally(() => pendingMissing.delete(dedupe))
}

function handlePostTranslation (translated, key) {
  if (!import.meta.client) return translated
  if (!locizeRuntime.isInContext) return translated
  if (typeof translated !== 'string') return translated

  const dot = key.indexOf('.')
  const ns = dot >= 0 ? key.slice(0, dot) : 'common'
  const actualKey = dot >= 0 ? key.slice(dot + 1) : key
  try {
    return wrap(translated, { key: actualKey, ns })
  } catch (_) {
    return translated
  }
}

// Don't wrap the default export with the Nuxt I18n macro — see warning
// at top of file. A plain default-export function works just as well;
// the module calls it at init time to read the config.
export default function () {
  // eslint-disable-next-line no-console
  console.log('[locize][i18n.config.ts] loaded; registering missing + postTranslation handlers')
  return {
    legacy: false,
    fallbackLocale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    missing: handleMissing,
    postTranslation: handlePostTranslation,
  }
}
