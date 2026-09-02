<script setup lang="ts">
defineOptions({ name: 'DocumentSummaryBar' });

export interface SummaryItem {
  label: string;
  value: number | string | null | undefined;
  /** Highlight as the document's headline figure. */
  primary?: boolean;
  /** Shown struck through, e.g. a total excluded by the trade term. */
  muted?: boolean;
}

withDefaults(
  defineProps<{
    items: SummaryItem[];
    pending?: boolean;
  }>(),
  { pending: false },
);

function display(value: SummaryItem['value']): string {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'number' ? value.toLocaleString('zh-CN') : String(value);
}
</script>

<template>
  <div
    class="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-[var(--el-border-color-lighter)] pt-3"
  >
    <div v-for="item in items" :key="item.label" class="min-w-28">
      <div class="text-xs text-[var(--el-text-color-secondary)]">{{ item.label }}</div>
      <div
        class="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight"
        :class="[
          item.primary ? 'text-[var(--el-color-primary)]' : 'text-[var(--el-text-color-primary)]',
          item.muted ? 'line-through opacity-50' : '',
        ]"
      >
        {{ display(item.value) }}
      </div>
    </div>
    <div class="ml-auto flex items-center gap-2 self-center">
      <span
        v-if="pending"
        class="rounded-full bg-[var(--el-color-warning-light-9)] px-2.5 py-0.5 text-xs font-medium text-[var(--el-color-warning-dark-2)]"
      >
        联动中…
      </span>
      <slot />
    </div>
  </div>
</template>
