<script setup lang="ts">
// See app.vue / pages/index.vue for why we use the global scope here.
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <main
    style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 720px; margin: 0 auto;"
  >
    <h1>{{ t('second.title') }}</h1>
    <p>
      <NuxtLink to="/">← {{ t('common.headTitle') }}</NuxtLink>
    </p>
  </main>
</template>
