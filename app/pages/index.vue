<script setup lang="ts">
// Use the global composer so t() goes through the same instance that
// the `app/plugins/locize.client.ts` plugin attaches `missing` +
// `postTranslation` to. In `legacy: false` mode, a plain `useI18n()`
// returns a per-component scoped composer that does NOT inherit those
// hooks from global — which would otherwise break saveMissing and the
// InContext editor's segment detection.
const { t, locale, locales, setLocale } = useI18n({ useScope: 'global' })

const availableLocales = computed(() =>
  (locales.value as { code: string; name?: string }[]).filter(
    (l) => l.code !== locale.value,
  ),
)
</script>

<template>
  <main
    style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 720px; margin: 0 auto;"
  >
    <h1>{{ t('index.title') }}</h1>
    <h2>{{t('index.new.untranslated', 'some new key')}}</h2>
    <p>
      <i18n-t keypath="index.description.part1">
        <template #file>
          <code>app/pages/index.vue</code>
        </template>
      </i18n-t>
    </p>
    <p>{{ t('index.description.part2') }}</p>

    <hr style="margin: 2rem 0;">

    <nav>
      <strong>Language:</strong>
      <span v-for="(l, i) in (locales as { code: string; name?: string }[])" :key="l.code">
        <a
          href="#"
          :style="{ fontWeight: l.code === locale ? 'bold' : 'normal', marginLeft: i === 0 ? '0.5rem' : 0 }"
          @click.prevent="setLocale(l.code as any)"
        >
          {{ l.name || l.code }}
        </a>
        <span v-if="i < (locales as unknown as unknown[]).length - 1"> · </span>
      </span>
    </nav>

    <p style="margin-top: 2rem;">
      <NuxtLink to="/second">→ {{ t('index.goto.second') }}</NuxtLink>
    </p>
  </main>
</template>
