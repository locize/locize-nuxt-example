# Nuxt 4 + [Locize](https://www.locize.com/?from=locize-nuxt-example) example

A minimal **Nuxt 4** sample showing how to wire
[`@nuxtjs/i18n`](https://i18n.nuxtjs.org) (vue-i18n underneath) with
[Locize](https://www.locize.com/?from=locize-nuxt-example) for build-time
translation sync via [`locize-cli`](https://github.com/locize/locize-cli),
runtime `saveMissing` to push new keys back to Locize during dev, and the
[Locize InContext editor](https://github.com/locize/locize) for translators
(`?incontext=true`).

Companion blog post: pending — this example ships first.

Stack: Nuxt 4.4 · `@nuxtjs/i18n` 10.3 · vue-i18n 11.4 · `locize` 4.0.24
(with the SSR-safe isInIframe fix + popup-survives-hydration fix) ·
`locize-cli` 12.1 · Vue 3.5 · TypeScript 5.9.

> This example uses the **Standard** Locize CDN
> (`api.lite.locize.app` — BunnyCDN, free, the default for new projects).
> If your project is on the **Pro** CDN (`api.locize.app`, CloudFront,
> paid), change `locizeCdnType` in
> [`i18n/locize.config.ts`](i18n/locize.config.ts) and the matching
> `--cdn-type` flag in the `downloadLocales` / `syncLocales` scripts in
> [`package.json`](package.json). See
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
2. Either edit
   [`i18n/locize.config.ts`](i18n/locize.config.ts),
   [`nuxt.config.ts`](nuxt.config.ts)'s `runtimeConfig.public`, and the
   `downloadLocales` / `syncLocales` scripts in
   [`package.json`](package.json) with your project id + api key, or
   keep the shipped demo-project credentials to try it out first.
3. Pre-bundle the translations: `npm run downloadLocales` — pulls the
   latest published JSON from Locize into `i18n/locales/{en,de}/*.json`.
   The committed JSON files act as sane defaults so the example builds
   without a Locize account.
4. `npm install && npm run dev`, then open <http://localhost:3000>.

## How the Locize integration works

Nuxt's Universal Mode runs the same Vue tree on the server (Nitro) and
on the client. We populate translations from **two sources**:

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

### Run time — `saveMissing` from client to Locize

[`app/plugins/locize.client.ts`](app/plugins/locize.client.ts) registers
a `missing` handler on the vue-i18n composer. When `t('any.unknown.key')`
is referenced and the key doesn't exist in the loaded JSON, the handler
POSTs to `https://api.lite.locize.app/missing/<projectId>/<version>/<lng>/<ns>`
with the dev-only apiKey, so the key appears in the Locize UI immediately.
**Only runs on the client and only in dev** (`import.meta.dev`). Production
builds with an empty `NUXT_PUBLIC_LOCIZE_API_KEY` no-op.

### Run time — InContext editor (`?incontext=true`)

The same plugin starts the
[`locize`](https://github.com/locize/locize) InContext editor when the URL
contains `?incontext=true` (or when the page itself is being rendered
inside the Locize editor iframe). The editor pops up in the
bottom-right corner; translators click on any string in the page to open
the key in the editor.

Since the `locize` package ships an i18next implementation but not a
vue-i18n one, the plugin defines a **custom vue-i18n implementation**
inline (mirrors `src/implementations/i18nextImplementation.js` from the
locize package, ported to vue-i18n's composer API:
`getLocaleMessage` / `mergeLocaleMessage` / `setLocaleMessage` instead
of i18next's resource APIs) and feeds it to the locize package's
`startStandalone()` entry point.

vue-i18n's `postTranslation` hook is wired to wrap each translation
output with the
[`i18next-subliminal`](https://github.com/locize/i18next-subliminal)
invisible-marker post-processor (re-exported from the locize package as
`wrap()`), so the editor can identify which key a clicked DOM string
came from. Like the React Router v7 example, wrapping happens
client-side only — Vue's hydration is more forgiving than React's about
text mismatches, so the worst case is a console warning rather than a
hydration-recovery sweep.

### `locize@4.0.24` SSR + popup-hydration safety

Two recent fixes in the `locize` package are relevant here even though
Nuxt doesn't use React's `hydrateRoot(document, ...)` pattern:

- **4.0.23** fixed `isInIframe` detection in Node 20+ SSR builds. Without
  it, the editor would have thought the SSR pass was rendering inside
  the Locize editor iframe and tried to attach editor listeners during
  the SSR render. See the
  [changelog](https://github.com/locize/locize/blob/master/CHANGELOG.md).
- **4.0.24** moved the popup append target from `document.body` to
  `document.documentElement` and added a bounded resurrection observer.
  Not strictly needed for Nuxt (Vue's hydration doesn't sweep `<body>`
  the way React's `clearContainerSparingly` does), but the resurrection
  observer is harmless and the `<html>` placement makes the popup
  resilient to any future framework that takes over `<body>`.

## Production safety

The write-enabled `apiKey` is hardcoded in
[`i18n/locize.config.ts`](i18n/locize.config.ts) and
[`nuxt.config.ts`](nuxt.config.ts) only because the demo project is
intentionally public. For your own project:

```sh
# .env (gitignored)
NUXT_PUBLIC_LOCIZE_PROJECT_ID=your-project-id
NUXT_PUBLIC_LOCIZE_API_KEY=your-dev-only-api-key
NUXT_PUBLIC_LOCIZE_VERSION=latest
NUXT_PUBLIC_LOCIZE_CDN_TYPE=standard
```

Nuxt's `runtimeConfig.public.locizeApiKey` will pick the env variable up
automatically because Nuxt maps `NUXT_PUBLIC_*` env vars to
`runtimeConfig.public.*` at build time. In production, deploy with an
**empty** `NUXT_PUBLIC_LOCIZE_API_KEY` so `saveMissing` no-ops
client-side.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Nuxt dev server on <http://localhost:3000> |
| `npm run build` | Production build into `.output/` |
| `npm run preview` | Run the production build via `node .output/server/index.mjs` |
| `npm run generate` | Static-site generation into `.output/public/` |
| `npm run typecheck` | `nuxt typegen && tsc --noEmit` |
| `npm run downloadLocales` | `locize download` — pull translations into `i18n/locales/` |
| `npm run syncLocales` | `locize sync` — two-way sync (dry-run by default) |

## File layout

```
locize-nuxt-example/
├── i18n.config.ts           — vue-i18n options consumed by @nuxtjs/i18n
├── nuxt.config.ts           — @nuxtjs/i18n module + runtimeConfig.public.locize*
├── app/
│   ├── app.vue              — root component, drives <title> + <html lang>
│   ├── pages/
│   │   ├── index.vue        — main page with language switcher
│   │   └── second.vue       — second page (route /second)
│   └── plugins/
│       └── locize.client.ts — saveMissing handler + InContext editor init
└── i18n/
    ├── locize.config.ts     — Locize credentials (projectId, apiKey, etc.)
    └── locales/
        ├── en.ts            — defineI18nLocale wrapper assembling en/*.json
        ├── de.ts            — same, for de/*.json
        ├── en/{common,index,second}.json
        └── de/{common,index,second}.json
```

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
