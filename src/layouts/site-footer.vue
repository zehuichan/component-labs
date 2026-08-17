<script setup lang="ts">
import WorkbenchMark from '@/components/brand/workbench-mark.vue';

defineOptions({ name: 'SiteFooter' });

const columns = [
  {
    label: 'COMPONENTS',
    links: [
      { label: 'PlusTable', to: '/plus-table/api-overview' },
      { label: 'Filters', to: '/filters/api-overview' },
      { label: 'ERP 场景', to: '/erp/api-overview' },
    ],
  },
  {
    label: 'COMPOSABLES',
    links: [
      { label: 'use-form-draft', to: '/composables/use-form-draft' },
      { label: 'use-auto-save', to: '/composables/use-auto-save' },
      { label: 'use-save-hotkey', to: '/composables/use-save-hotkey' },
    ],
  },
] as const;
</script>

<template>
  <footer class="border-t border-border bg-background">
    <div
      class="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-6 py-12 sm:flex-row sm:justify-between"
    >
      <div>
        <div class="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <WorkbenchMark :size="20" />
          <span>Workbench</span>
        </div>
        <p class="mt-3 text-[13.5px] leading-relaxed whitespace-nowrap text-muted-foreground">
          面向中后台复杂业务录入与字段联动的 Vue 3 工作台。
        </p>
      </div>

      <div class="flex gap-12">
        <div v-for="column in columns" :key="column.label">
          <p class="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground">
            {{ column.label }}
          </p>
          <ul class="mt-3 space-y-2">
            <li v-for="link in column.links" :key="link.to">
              <RouterLink
                :to="link.to"
                class="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {{ link.label }}
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="border-t border-border">
      <div
        class="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-6 py-5 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
      >
        <span>© Workbench contributors · Vue 3 business data entry playground</span>
        <a
          href="https://github.com/zehuichan/workbench"
          target="_blank"
          rel="noopener noreferrer"
          class="transition-colors hover:text-foreground"
        >
          GitHub
        </a>
      </div>
    </div>
  </footer>
</template>
