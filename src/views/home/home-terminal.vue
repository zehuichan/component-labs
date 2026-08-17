<script setup lang="ts">
import { ref } from 'vue';
import { cn } from '@/utils';
import HomeCommand from './home-command.vue';

defineOptions({ name: 'HomeTerminal' });

const tabs = [
  {
    id: 'run',
    label: '本地启动',
    cwd: '~/workbench',
    commands: ['pnpm install', 'pnpm dev'],
  },
  {
    id: 'clone',
    label: '拉取源码',
    cwd: '~',
    commands: ['git clone https://github.com/zehuichan/workbench'],
  },
] as const;

const active = ref<(typeof tabs)[number]['id']>('run');
const current = () => tabs.find((tab) => tab.id === active.value) ?? tabs[0];
</script>

<template>
  <div>
    <div class="flex items-center gap-1" role="tablist" aria-label="安装方式">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="active === tab.id"
        :class="
          cn(
            'rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors',
            active === tab.id
              ? 'bg-white/10 text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )
        "
        @click="active = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="mt-2 overflow-hidden rounded-xl border border-border bg-white/[0.04] backdrop-blur">
      <div class="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <span class="flex items-center gap-1.5" aria-hidden="true">
          <i class="size-2.5 rounded-full bg-[#ff5f57]/80" />
          <i class="size-2.5 rounded-full bg-[#febc2e]/80" />
          <i class="size-2.5 rounded-full bg-[#28c840]/80" />
        </span>
        <span class="ml-1.5 font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
          {{ current().cwd }}
        </span>
      </div>

      <div class="min-h-[7.5rem] space-y-2 p-3">
        <HomeCommand v-for="command in current().commands" :key="command" :command="command" />
      </div>
    </div>
  </div>
</template>
