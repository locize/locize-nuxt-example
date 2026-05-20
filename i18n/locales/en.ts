// Assemble the per-locale message object from the per-namespace JSON
// files that `locize-cli` downloads into `i18n/locales/<lng>/<ns>.json`.
// vue-i18n doesn't have first-class namespaces — keys are nested under
// whatever shape the messages object has — so we wrap each JSON file's
// contents under its namespace name to preserve a `t('<ns>.<key>')`
// lookup pattern that round-trips through Locize cleanly.
import common from './en/common.json'
import index from './en/index.json'
import second from './en/second.json'

export default defineI18nLocale(() => ({
  common,
  index,
  second,
}))
