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
import { h, Text } from 'vue'
import { wrap } from 'locize'
import { locizeRuntime } from '../app/utils/locize-runtime'

const pendingMissing = new Set()

function handleMissing (locale, key) {
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
  }).then((res) => {
    // Locize returns 412 "Unnecessary Request: Nothing was missing!"
    // when the key was already pushed in a previous session (e.g. by
    // a prior `locize sync` or another tab). That's expected and not
    // an error — swallow it silently. Other non-2xx responses log
    // once so misconfiguration is visible.
    if (!res.ok && res.status !== 412 && import.meta.dev) {
      // eslint-disable-next-line no-console
      console.warn('[locize] saveMissing POST returned', res.status, key)
    }
  }).catch(() => {
    /* network errors are a swallow — translator will see the key
     * appear on the next dev-server lifecycle anyway. */
  }).finally(() => pendingMissing.delete(dedupe))
}

// Sentinel used to extract start/end markers from a `wrap()` output for
// the array-input case. U+FFFC (Object Replacement Character) is unused
// in normal text, so the split is unambiguous.
const MARKER_SENTINEL = '￼'

function handlePostTranslation (translated, key) {
  if (!import.meta.client) return translated
  if (!locizeRuntime.isInContext) return translated


  const dot = key.indexOf('.')
  const ns = dot >= 0 ? key.slice(0, dot) : 'common'
  const actualKey = dot >= 0 ? key.slice(dot + 1) : key
  const meta = { key: actualKey, ns }

  // Plain string: wrap the whole thing once.
  if (typeof translated === 'string') {
    try { return wrap(translated, meta) } catch (_) { return translated }
  }

  // VNode array — this is what vue-i18n's `<i18n-t>` component path
  // produces. Important nuance: vue-i18n's internal `normalize()` (see
  // `node_modules/vue-i18n/dist/vue-i18n.mjs` line 589) converts every
  // string/number/boolean segment to a Vue Text VNode BEFORE
  // postTranslation runs. So the array we receive contains ZERO raw
  // strings — it's all `{__v_isVNode: true, type: Text, children:
  // "..."}` for text segments and `{__v_isVNode: true, type: '<tag>',
  // children: [...]}` for slot VNodes.
  //
  // We identify text VNodes (`children` is a string) and rebuild the
  // first + last with markers embedded in their `children`. Fresh
  // VNodes via `h(Text, null, ...)` rather than mutating the originals
  // so Vue's render diffing sees a clean change.
  if (Array.isArray(translated)) {
    const isTextVNode = (v: any) =>
      v && v.__v_isVNode && typeof v.children === 'string'

    const firstTextIdx = translated.findIndex(isTextVNode)
    if (firstTextIdx === -1) return translated
    let lastTextIdx = firstTextIdx
    for (let i = translated.length - 1; i >= 0; i--) {
      if (isTextVNode(translated[i])) { lastTextIdx = i; break }
    }

    let startMarker: string
    let endMarker: string
    try {
      const sample = wrap(MARKER_SENTINEL, meta)
      const parts = sample.split(MARKER_SENTINEL)
      if (parts.length !== 2) return translated
      startMarker = parts[0]
      endMarker = parts[1]
    } catch (_) {
      return translated
    }

    const result = translated.slice()
    if (firstTextIdx === lastTextIdx) {
      const orig = result[firstTextIdx] as any
      result[firstTextIdx] = h(Text, null, startMarker + orig.children + endMarker) as any
    } else {
      const first = result[firstTextIdx] as any
      const last = result[lastTextIdx] as any
      result[firstTextIdx] = h(Text, null, startMarker + first.children) as any
      result[lastTextIdx] = h(Text, null, last.children + endMarker) as any
    }
    return result
  }

  return translated
}

// Don't wrap the default export with the Nuxt I18n macro — see warning
// at top of file. A plain default-export function works just as well;
// the module calls it at init time to read the config.
export default function () {
  return {
    legacy: false,
    fallbackLocale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    missing: handleMissing,
    postTranslation: handlePostTranslation,
  }
}
