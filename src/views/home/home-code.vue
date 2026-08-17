<script setup lang="ts">
import { ref, watch } from 'vue';
import { highlightCode } from '@/components/demo/demo-highlighter';

defineOptions({ name: 'HomeCode' });

const props = withDefaults(
  defineProps<{
    code: string;
    label: string;
    lang?: string;
    note?: string;
  }>(),
  { lang: 'ts' },
);

const html = ref('');
let renderToken = 0;

watch(
  () => [props.code, props.lang] as const,
  async () => {
    const token = ++renderToken;
    try {
      const next = await highlightCode(props.code, props.lang, 'github-dark');
      if (token === renderToken) html.value = next;
    } catch {
      if (token === renderToken) html.value = '';
    }
  },
  { immediate: true },
);
</script>

<template>
  <figure class="overflow-hidden rounded-xl border border-border bg-background">
    <figcaption class="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2">
      <span
        class="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.06em] text-muted-foreground"
      >
        <i class="size-1.5 rounded-full bg-[var(--brand)]" aria-hidden="true" />
        {{ props.label }}
      </span>
      <b
        v-if="props.note"
        class="font-mono text-[11px] font-medium tracking-[0.06em] text-[var(--brand)]"
      >
        {{ props.note }}
      </b>
    </figcaption>

    <div v-if="html" class="home-code" v-html="html" />
    <pre v-else class="home-code__fallback">{{ props.code }}</pre>
  </figure>
</template>

<style scoped>
.home-code :deep(pre),
.home-code__fallback {
  margin: 0;
  overflow-x: auto;
  padding: 18px 20px;
  background-color: var(--code-canvas) !important;
  color: var(--paper);
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.7;
  scrollbar-width: thin;
}
</style>
