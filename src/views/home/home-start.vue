<script setup lang="ts">
import HomeCommand from './home-command.vue';
import { vReveal } from './use-reveal';

defineOptions({ name: 'HomeStart' });

const steps = [
  {
    title: '拉取源码',
    description: '克隆仓库，所有示例与 composables 都在 src/ 下，可以直接复制到你的项目。',
    commands: ['git clone https://github.com/zehuichan/workbench'],
  },
  {
    title: '本地启动',
    description: 'Node.js ≥ 20.19 与 pnpm ≥ 10，安装后启动 Vite Playground（默认 :8000）。',
    commands: ['pnpm install', 'pnpm dev'],
  },
] as const;
</script>

<template>
  <section class="mx-auto w-full max-w-[1200px] px-6 pb-24 lg:pb-32">
    <div v-reveal class="max-w-2xl">
      <p
        class="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 font-mono text-[10.5px] font-medium tracking-[0.14em] text-muted-foreground"
      >
        开始使用
      </p>

      <h2
        class="mt-6 text-[clamp(1.75rem,3.6vw,2.4rem)] leading-[1.2] font-semibold tracking-[-0.02em]"
      >
        拉下源码，五分钟跑起来
      </h2>
    </div>

    <div class="mt-10 grid gap-4 md:grid-cols-2">
      <div
        v-for="(step, index) in steps"
        :key="step.title"
        v-reveal="index * 90"
        class="rounded-xl border border-border bg-background p-6"
      >
        <h3 class="text-[15px] font-semibold tracking-[-0.01em]" v-text="step.title" />
        <p
          class="mt-2 text-[13.5px] leading-relaxed text-muted-foreground"
          v-text="step.description"
        />

        <div class="mt-5 space-y-2">
          <HomeCommand v-for="command in step.commands" :key="command" :command="command" />
        </div>
      </div>
    </div>
  </section>
</template>
