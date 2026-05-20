<script setup lang="ts">
// Use the global i18n scope explicitly. `app.vue` sits above any component
// that owns an i18n parent scope, so without this the SSR pass logs an
// `[intlify] Not found parent scope` warning before falling back to global.
const { t, locale } = useI18n({ useScope: 'global' })

// Drive <html lang> + <title> from i18n state. `useHead` is reactive,
// so the title changes with the locale.
useHead({
  htmlAttrs: { lang: () => locale.value },
  title: () => t('common.headTitle'),
})
</script>

<template>
  <NuxtPage />
</template>
