<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { ArrowRightIcon, LayersIcon } from '@lucide/vue';
import GithubMark from '@/components/brand/github-mark.vue';
import { useInkBand } from '@/layouts/site-ink-band';
import { Button } from '@/ui/button';
import { vReveal } from './use-reveal';

defineOptions({ name: 'HomeCta' });

useInkBand(useTemplateRef<HTMLElement>('band'));
</script>

<template>
  <section ref="band" class="dark relative isolate overflow-hidden bg-background text-foreground">
    <div class="site-ink-aura absolute inset-0 -z-10 opacity-70" aria-hidden="true" />
    <div
      class="site-dot-grid site-mask-fade-y absolute inset-0 -z-10 opacity-70"
      aria-hidden="true"
    />

    <div v-reveal class="mx-auto w-full max-w-[1200px] px-6 py-28 text-center lg:py-36">
      <p
        class="font-mono text-[11px] font-medium tracking-[0.08em] text-[var(--playground-accent)]"
      >
        READY
      </p>

      <h2
        class="mt-5 text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.15] font-semibold tracking-[-0.02em]"
      >
        从一张表格开始。
      </h2>

      <p class="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
        打开 Playground，把可编辑表格、字段联动与草稿保存接进你的业务单据。
      </p>

      <div class="mt-9 flex flex-wrap items-center justify-center gap-2.5">
        <Button as-child size="lg" class="h-10 rounded-full px-4.5">
          <RouterLink to="/plus-table/basic-editing">
            打开 Playground
            <ArrowRightIcon class="size-4" aria-hidden="true" />
          </RouterLink>
        </Button>
        <Button as-child size="lg" variant="outline" class="h-10 rounded-full px-4">
          <RouterLink to="/composables/use-form-draft">
            <LayersIcon class="size-4" aria-hidden="true" />
            浏览 Composables
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
  </section>
</template>
