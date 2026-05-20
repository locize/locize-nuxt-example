<script setup lang="ts">
const { t } = useI18n()
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
