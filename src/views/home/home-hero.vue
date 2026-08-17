<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { ArrowRightIcon, LayersIcon, WorkflowIcon } from '@lucide/vue';
import GithubMark from '@/components/brand/github-mark.vue';
import { useInkBand } from '@/layouts/site-ink-band';
import { Button } from '@/ui/button';
import HomeTerminal from './home-terminal.vue';
import { vReveal } from './use-reveal';

defineOptions({ name: 'HomeHero' });

useInkBand(useTemplateRef<HTMLElement>('band'));
</script>

<template>
  <section
    ref="band"
    class="dark relative isolate -mt-14 overflow-hidden bg-background pt-14 text-foreground"
    aria-labelledby="home-hero-title"
  >
    <div class="site-ink-aura absolute inset-0 -z-10" aria-hidden="true" />
    <div
      class="site-dot-grid site-mask-fade-b absolute inset-0 -z-10 opacity-70"
      aria-hidden="true"
    />

    <div class="mx-auto w-full max-w-[1200px] px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
      <div class="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
        <div v-reveal>
          <p
            class="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground"
          >
            <i class="size-1.5 rounded-full bg-[var(--playground-accent)]" aria-hidden="true" />
            VUE 3 · BUSINESS DATA ENTRY WORKBENCH
          </p>

          <h1
            id="home-hero-title"
            class="mt-6 text-[clamp(2.4rem,5.4vw,3.5rem)] leading-[1.08] font-semibold tracking-[-0.03em]"
          >
            表头改一处，<br />
            明细自动跟上。
          </h1>

          <div class="mt-6 max-w-xl space-y-3 text-[15px] leading-relaxed text-muted-foreground">
            <p>
              面向中后台复杂业务录入的 Vue 3
              工作台，把可编辑表格、字段联动与草稿保存做成可以直接抄走的实现。
            </p>
            <p>
              PlusTable 承担三种编辑粒度，useEmitEffect
              把联动收敛成一张规则表，草稿与自动保存兜住每一次输入。
            </p>
          </div>

          <div class="mt-9 flex flex-wrap items-center gap-2.5">
            <Button as-child size="lg" class="h-10 rounded-full px-4.5">
              <RouterLink to="/plus-table/basic-editing">
                快速开始
                <ArrowRightIcon class="size-4" aria-hidden="true" />
              </RouterLink>
            </Button>
            <Button as-child size="lg" variant="outline" class="h-10 rounded-full px-4">
              <RouterLink to="/erp/sales-order-linkage">
                <WorkflowIcon class="size-4" aria-hidden="true" />
                ERP 联动
              </RouterLink>
            </Button>
            <Button as-child size="lg" variant="outline" class="h-10 rounded-full px-4">
              <RouterLink to="/composables/use-form-draft">
                <LayersIcon class="size-4" aria-hidden="true" />
                Composables
              </RouterLink>
            </Button>
            <Button as-child size="lg" variant="outline" class="h-10 rounded-full px-4">
              <a
                href="https://github.com/zehuichan/workbench"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubMark class="size-4" />
                GitHub
              </a>
            </Button>
          </div>
        </div>

        <div v-reveal="120">
          <HomeTerminal />
        </div>
      </div>
    </div>
  </section>
</template>
