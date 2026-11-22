# Nuxt 4 + [Locize](https://www.locize.com/?from=locize-nuxt-example) example

A minimal **Nuxt 4** sample showing how to wire
[`@nuxtjs/i18n`](https://i18n.nuxtjs.org) (vue-i18n underneath) with
[Locize](https://www.locize.com/?from=locize-nuxt-example) for build-time
translation sync via [`locize-cli`](https://github.com/locize/locize-cli),
runtime `saveMissing` to push new keys back to Locize during dev, and the
[Locize InContext editor](https://github.com/locize/locize) for translators
(`?incontext=true`).

Companion blog post: [How to internationalize a Nuxt 4 app with @nuxtjs/i18n and Locize](https://www.locize.com/blog/nuxt-i18n?from=locize-nuxt-example).

Stack: Nuxt 4.4 · `@nuxtjs/i18n` 10.3 · vue-i18n 11.4 · `locize` 4.7.0
(ships a vue-i18n implementation alongside the existing i18next one) ·
`locize-cli` 12.1 · Vue 3.5 · TypeScript 5.9.

> This example uses the **Standard** Locize CDN
> (`api.lite.locize.app` — BunnyCDN, free, the default for new projects).
> If your project is on the **Pro** CDN (`api.locize.app`, CloudFront,
> paid), change `locizeCdnType` in
> [`nuxt.config.ts`](nuxt.config.ts)'s `runtimeConfig.public` and the
> matching `--cdn-type` flag in the `downloadLocales` / `syncLocales`
> scripts in [`package.json`](package.json). See
> [CDN types: Standard vs. Pro](https://www.locize.com/docs/integration/cdn-types-standard-vs-pro?from=locize-nuxt-example).

> Companion examples on other React-ecosystem frameworks:
> [`locize-react-router-example`](https://github.com/locize/locize-react-router-example)
> (React Router v7 framework mode + remix-i18next 7.x),
> [`locize-remix-i18next-example`](https://github.com/locize/locize-remix-i18next-example)
> (Remix v2 + remix-i18next 6.x). All three share the same
> SSR-bundled-translations + client-side `saveMissing` shape.

## Getting started

1. Create a free account and a project at
   <https://www.locize.com/?from=locize-nuxt-example>. When the new-
   project wizard asks for an **i18n format**, pick **vue-i18n** (Locize
   stores the messages in vue-i18n-native format: single-brace
   interpolation, pipe-separated plurals).
2. Either edit the `runtimeConfig.public.locize*` values in
   [`nuxt.config.ts`](nuxt.config.ts) and the `--project-id` / `--api-key`
   flags in the `downloadLocales` / `syncLocales` scripts in
   [`package.json`](package.json) with your own project id + api key,
   or keep the shipped demo-project credentials to try it out first.
3. Pre-bundle the translations: `npm run downloadLocales` — pulls the
   latest published JSON from Locize into `i18n/locales/{en,de}/*.json`.
   The committed JSON files act as sane defaults so the example builds
   without a Locize account.
4. `npm install && npm run dev`, then open <http://localhost:3000>.

## How the Locize integration works

**Translations are bundled at build time, not fetched at runtime.**
`locize-cli` pulls the latest published JSON from the Locize CDN into
`i18n/locales/{en,de}/*.json` once (via `npm run downloadLocales`,
typically wired into a `prebuild` step). `@nuxtjs/i18n`'s lazy-load
then reads those bundled JSON files on both the server (Nitro SSR)
and the client — same files, one source of truth. A "published a new
translation → users see it" round trip therefore requires re-running
`downloadLocales` and redeploying; this is by design here, and keeps
the runtime serverless-friendly (no per-request CDN hop from Nitro,
no extra fetch on the client beyond the locale's own lazy chunk).

Two **optional** runtime touchpoints with Locize are layered on top:

- **`saveMissing`** (optional) pushes any newly-referenced key from
  the app's `t()` calls back to the Locize project at runtime —
  write-only, doesn't fetch translations. Convenient during dev so
  developers don't have to remember to add new keys manually, but
  you can absolutely skip this and only ever sync up via
  `npm run syncLocales` (the locize-cli pushes any keys present in
  local JSON that aren't yet in Locize). Two ways into the same
  outcome: pick whichever fits your workflow / CI policy / comfort
  with a write-enabled dev apiKey.
- **InContext editor** (`?incontext=true`) opens the editor as an
  iframe; translators can edit live, but their saves land in Locize
  and only show up in the bundled translations after the next
  `downloadLocales` + redeploy.

> If you'd rather have client-side live-fetch of fresh translations
> (publish in Locize → next page view picks it up, no redeploy), see
> the [`locize-react-router-example`](https://github.com/locize/locize-react-router-example)
> for the shape with `i18next-locize-backend`. That requires moving
> from `@nuxtjs/i18n` / vue-i18n to i18next + i18next-vue, since
> vue-i18n doesn't have a comparable runtime-backend hook today.

### Build time — `locize-cli` → local JSON

`npm run downloadLocales` (or wire it into `prebuild` for CI) calls
[`locize-cli`](https://github.com/locize/locize-cli)'s `download` command
against the Standard CDN and writes the JSON into
`i18n/locales/{en,de}/{common,index,second}.json`. These files get
imported by [`i18n/locales/en.ts`](i18n/locales/en.ts) and
[`i18n/locales/de.ts`](i18n/locales/de.ts), each of which uses
`@nuxtjs/i18n`'s `defineI18nLocale()` to wrap the per-namespace JSON
under its namespace key so `t('common.headTitle')` / `t('index.title')`
resolve cleanly.

**Why per-namespace JSON files instead of a single locale file?** That's
what Locize emits — one file per namespace per language — and the
`locize sync` round-trip preserves that layout. Merging into a single
file would require a custom unflatten step on every sync.

**Why a `.ts` wrapper per locale?** vue-i18n doesn't have first-class
namespaces (unlike i18next). The locale messages object is just a deep
JSON tree, and `t('foo.bar')` is a nested-key lookup. To preserve the
namespace structure round-tripping through Locize, each `.ts` wrapper
assembles the per-namespace JSON imports under the namespace name.

### Run time — `saveMissing` (optional; client → Locize, write-only)

[`i18n/i18n.config.ts`](i18n/i18n.config.ts) registers a `missing` handler
on the vue-i18n global composer at vue-i18n init time. When
`t('any.unknown.key')` is referenced and the key doesn't exist in the
loaded JSON, the handler POSTs to
`https://api.lite.locize.app/missing/<projectId>/<version>/<lng>/<ns>`
with the dev-only apiKey. The key appears in the Locize UI immediately;
translators can fill it in there. **No translation is fetched back at
runtime** — the new value lands in the app's bundled translations only
after the next `downloadLocales` + build cycle.

The handler **only runs on the client and only when the runtime flag is
set by [`app/plugins/locize.client.ts`](app/plugins/locize.client.ts)** —
which gates it on `import.meta.dev && !!apiKey`. Production builds with
an empty `NUXT_PUBLIC_LOCIZE_API_KEY` no-op.

**`saveMissing` is optional.** If you'd rather not ship a write-enabled
apiKey in your dev bundle (or you'd rather keep the dev console quiet),
skip it entirely and use one of these instead:

- `npm run syncLocales` (drop the `--dry=true` flag): `locize-cli` reads
  your local `i18n/locales/{lng}/{ns}.json` and uploads any keys not
  yet in Locize. Manual or CI-triggered; no write-key in the browser.
- Static extraction via [`i18next-cli`](https://github.com/i18next/i18next-cli)
  or similar — scans your source code, writes new keys into the local
  JSON files, then sync up as above.

To disable `saveMissing` in this example, delete the handler from
`i18n/i18n.config.ts` (or just remove the `apiKey` from
`nuxt.config.ts`'s `runtimeConfig.public` so the handler no-ops).

### Run time — InContext editor (`?incontext=true`)

The plugin starts the [`locize`](https://github.com/locize/locize)
InContext editor when the URL contains `?incontext=true`, or did earlier
in the same browser tab (`?incontext=false` switches it off), or when the
page itself is being rendered inside the Locize editor iframe. The
editor pops up in the bottom-right corner; translators click on any
string in the page to open the key in the editor.

The `locize` package ships
[`getVueI18nImplementation`](https://github.com/locize/locize/blob/master/src/implementations/vueI18nImplementation.js)
alongside the existing i18next adapter (since 4.1.0), so the plugin
hands it the vue-i18n composer + project details and passes the
resulting `Implementation` to `startStandalone({ implementation })`.
Vue's `watch` is supplied as an option so the editor can observe locale
switches — locize itself stays free of a `vue` peer dep.

vue-i18n's `postTranslation` hook is wired in
[`i18n/i18n.config.ts`](i18n/i18n.config.ts) to wrap each translation
output with the
[`i18next-subliminal`](https://github.com/locize/i18next-subliminal)
invisible-marker post-processor (re-exported from the locize package as
`wrap()`), so the editor can identify which key a clicked DOM string
came from. The handler covers two shapes:

- **Plain string** (what `t('key')` produces) — wrap the string once.
- **VNode array** (what `<i18n-t keypath="..." scope="global">` produces
  with slot interpolation, because vue-i18n's internal `normalize()`
  converts every string segment to a Vue Text VNode before
  `postTranslation` runs) — identify the first and last text VNodes and
  rebuild them via `h(Text, null, startMarker + children)` /
  `h(Text, null, children + endMarker)`, leaving slot VNodes untouched.
  The locize parser's existing multi-text-node merge logic then stitches
  the pieces back together for the parent element.

Wrapping only happens client-side, and only when `?incontext=true` is
active. The SSR pass renders unwrapped strings, so under `?incontext=true`
the dev console logs **`[Vue warn] Hydration text content mismatch`** for
every translated string. Vue's hydration is forgiving of text mismatches:
it trusts the client output and updates the DOM, so the page renders
correctly and the editor's parser sees the wrapped strings. The warnings
are noise, not failure. Normal page loads (editor off) have no
mismatch.

### `locize@4.1.0` SSR + parser robustness

The integration relies on three fixes in the `locize` package:

- **4.0.23** fixed `isInIframe` detection in Node 20+ SSR builds. Without
  it, the editor would think the SSR pass was rendering inside the
  Locize editor iframe and try to attach editor listeners during SSR.
- **4.0.24** moved the popup append target from `document.body` to
  `document.documentElement` and added a bounded resurrection observer.
  Not strictly needed for Nuxt (Vue's hydration doesn't sweep `<body>`
  the way React's `clearContainerSparingly` does), but the `<html>`
  placement makes the popup resilient to any framework that takes over
  `<body>`.
- **4.1.0** shipped `getVueI18nImplementation` (used by this example) plus
  a parser robustness fix: text nodes that contain a full subliminal
  end marker but don't start with the start marker are now correctly
  detected. That trip-wire fires whenever a framework's template
  compiler merges literal text with a `t()` output into a single text
  node — Vue does this for `→ {{ t('...') }}` patterns. Best practice
  is still to move literal prefixes into the translation value (RTL
  reorder-friendly), but the parser now handles both shapes.

See the
[`locize` changelog](https://github.com/locize/locize/blob/master/CHANGELOG.md)
for the full details on each release.

## Production safety

The write-enabled `apiKey` is hardcoded in [`nuxt.config.ts`](nuxt.config.ts)
only because the demo project is intentionally public. For your own
project:

```sh
# .env (gitignored)
NUXT_PUBLIC_LOCIZE_PROJECT_ID=your-project-id
NUXT_PUBLIC_LOCIZE_API_KEY=your-dev-only-api-key
NUXT_PUBLIC_LOCIZE_VERSION=latest
NUXT_PUBLIC_LOCIZE_CDN_TYPE=standard
```

Nuxt maps `NUXT_PUBLIC_*` env vars to `runtimeConfig.public.*` at build
time, so the same keys the plugin reads in dev get overridden in
production. Deploy production with an **empty**
`NUXT_PUBLIC_LOCIZE_API_KEY` so `saveMissing` no-ops client-side.

## IDE setup

Use the official Vue (Volar) VS Code extension — `Vue.volar`. The
deprecated **Vetur** extension doesn't pick up the type augmentations
that `@nuxtjs/i18n` generates in `.nuxt/types/i18n-plugin.d.ts` (which is
what teaches vue-i18n's `Composer` about `locales`, `setLocale`,
`defaultLocale`, etc.), so it falsely flags `Property 'locales' does
not exist on type 'Composer<...>'` and similar errors that `nuxt
typecheck` correctly accepts.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Nuxt dev server on <http://localhost:3000> |
| `npm run build` | Production build into `.output/` |
| `npm run preview` | Run the production build via `node .output/server/index.mjs` |
| `npm run generate` | Static-site generation into `.output/public/` |
| `npm run typecheck` | `nuxt typecheck` (uses `vue-tsc` under the hood) |
| `npm run downloadLocales` | `locize download` — pull translations into `i18n/locales/` |
| `npm run syncLocales` | `locize sync` — two-way sync (dry-run by default) |

## File layout

```
locize-nuxt-example/
├── nuxt.config.ts           — @nuxtjs/i18n module + runtimeConfig.public.locize*
├── app/
│   ├── app.vue              — root component, drives <title> + <html lang>
│   ├── pages/
│   │   ├── index.vue        — main page with language switcher
│   │   └── second.vue       — second page (route /second)
│   ├── plugins/
│   │   └── locize.client.ts — populates locize runtime state + InContext editor init
│   └── utils/
│       └── locize-runtime.ts — shared mutable runtime state for the i18n config handlers
└── i18n/
    ├── i18n.config.ts       — vue-i18n options (missing + postTranslation handlers)
    └── locales/
        ├── en.ts            — defineI18nLocale wrapper assembling en/*.json
        ├── de.ts            — same, for de/*.json
        ├── en/{common,index,second}.json
        └── de/{common,index,second}.json
```

**Why `i18n/i18n.config.ts` and not `i18n.config.ts` at root?** Nuxt I18n
10.x resolves the vue-i18n config file relative to `layer.i18nDir` (the
`i18n/` directory) — see `findPath(layer.i18n.vueI18n || "i18n.config",
{ cwd: layer.i18nDir })` in `@nuxtjs/i18n/dist/module.mjs`. A root-level
`i18n.config.ts` is silently not loaded.

**Why no `defineI18nConfig(...)` macro wrapper?** Nuxt I18n's module
post-processes any file containing the macro identifier with a greedy
regex (`DEFINE_I18N_FN_RE`) that has been observed to corrupt file
output when comments or string literals also contain the macro name.
Plain `export default function () { ... }` works just as well and
bypasses the macro entirely.

**Why is there a `locize-runtime.ts` bridge?** `i18n/i18n.config.ts`
runs at vue-i18n init time (so its handlers are on the composer from
the first `t()` call) but has no access to `useRuntimeConfig()`. The
client plugin DOES have access — it populates the shared
`locizeRuntime` module-state once at startup, and the handlers read
from it on each call.

## Related

- [Locize platform docs](https://www.locize.com/docs?from=locize-nuxt-example)
- [`@nuxtjs/i18n` documentation](https://i18n.nuxtjs.org)
- React Router v7 framework-mode alternative:
  [`locize-react-router-example`](https://github.com/locize/locize-react-router-example)
  ([blog walkthrough](https://www.locize.com/blog/react-router-i18next?from=locize-nuxt-example))
- Remix v2 alternative:
  [`locize-remix-i18next-example`](https://github.com/locize/locize-remix-i18next-example)
  ([blog walkthrough](https://www.locize.com/blog/remix-i18next?from=locize-nuxt-example))
- Next.js + Locize alternative:
  [`next-i18next-locize`](https://github.com/locize/next-i18next-locize)
