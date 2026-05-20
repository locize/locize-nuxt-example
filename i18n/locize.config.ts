// Public demo-project credentials so the example "just works" out of the
// box. For your own project, source these from a git-ignored env file (e.g.
// `process.env.NUXT_PUBLIC_LOCIZE_*`) and surface them via `runtimeConfig`
// in `nuxt.config.ts`. The `apiKey` is only ever used in dev for
// `saveMissing` — production builds should never ship a write-enabled key.
export const locizeProjectId = '24717bdc-b48a-4520-a702-88b7f45bcb0a'

// Dev-only API key for the public demo project. Replace with your own.
// In a real project, gate this on `!isProduction` and source from env.
export const locizeApiKey = 'lz_api_1AQjKuZRaLQlRQGqPEHWruvNtF1dN8F4'

export const locizeVersion = 'latest'

// 'standard' → api.lite.locize.app (BunnyCDN, free, default for new projects)
// 'pro'      → api.locize.app (CloudFront, paid, supports private downloads)
export type LocizeCdnType = 'standard' | 'pro'
export const locizeCdnType: LocizeCdnType = 'standard'

// Derived CDN host for runtime client-side fetches and the InContext editor
// wiring. Locize-cli reads the same `cdnType` via its `--cdn-type` flag in
// `package.json` scripts.
const LOCIZE_CDN_HOSTS: Record<LocizeCdnType, string> = {
  standard: 'https://api.lite.locize.app',
  pro: 'https://api.locize.app',
}
export const locizeHost = LOCIZE_CDN_HOSTS[locizeCdnType]

export const locizeReferenceLng = 'en'

export const locizeNamespaces = ['common', 'index', 'second'] as const
