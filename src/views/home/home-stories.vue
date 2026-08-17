<script setup lang="ts">
import { ArrowUpRightIcon } from '@lucide/vue';
import { cn } from '@/utils';
import HomeCode from './home-code.vue';
import { columnsSnippet, linkageSnippet, persistSnippet } from './home-snippets';
import { vReveal } from './use-reveal';

defineOptions({ name: 'HomeStories' });

const stories = [
  {
    index: '01',
    kicker: 'EDIT',
    title: '单元格、行、整表，三种编辑粒度',
    lede: '同一份 columns 描述展示与编辑，切换 mode 就能在 cell / row / table 之间移动编辑粒度，历史与脏数据自动追踪。',
    link: { label: '查看 PlusTable API', to: '/plus-table/api-overview' },
    snippet: columnsSnippet,
  },
  {
    index: '02',
    kicker: 'LINK',
    title: '表头驱动明细，规则写在一处',
    lede: '把「哪个字段变化、影响哪些字段」声明成规则表，销售、采购、费用报销三条 ERP 单据共用同一套联动引擎。',
    link: { label: '查看 ERP 联动场景', to: '/erp/sales-order-linkage' },
    snippet: linkageSnippet,
  },
  {
    index: '03',
    kicker: 'PERSIST',
    title: '草稿、自动保存，和一次 Ctrl + S',
    lede: '未提交的输入落到本地，自动保存按节奏静默提交，保存动作收敛到一个快捷键——刷新页面也不丢录入。',
    link: { label: '查看 Form Composables', to: '/composables/use-form-draft' },
    snippet: persistSnippet,
  },
] as const;
</script>

<template>
  <section class="mx-auto w-full max-w-[1200px] px-6 pb-24 lg:pb-32">
    <div v-reveal class="max-w-2xl">
      <p
        class="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 font-mono text-[10.5px] font-medium tracking-[0.14em] text-muted-foreground"
      >
        设计思路
      </p>

      <h2
        class="mt-6 text-[clamp(1.75rem,3.6vw,2.4rem)] leading-[1.2] font-semibold tracking-[-0.02em]"
      >
        三种粒度、一处规则、不丢草稿
      </h2>
    </div>

    <div class="mt-14 space-y-16 lg:mt-16 lg:space-y-24">
      <article
        v-for="(story, index) in stories"
        :key="story.index"
        v-reveal
        class="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
      >
        <div :class="cn('lg:max-w-[30rem]', index % 2 === 1 && 'lg:order-2 lg:justify-self-end')">
          <p
            class="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground"
          >
            <span class="text-[var(--brand)]" v-text="story.index" />
            {{ story.kicker }}
          </p>

          <h3
            class="mt-4 text-[clamp(1.35rem,2.4vw,1.7rem)] leading-[1.3] font-semibold tracking-[-0.02em]"
            v-text="story.title"
          />

          <p class="mt-4 text-[15px] leading-relaxed text-muted-foreground" v-text="story.lede" />

          <RouterLink
            :to="story.link.to"
            class="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--brand)] transition-colors hover:text-[var(--brand-hover)]"
          >
            {{ story.link.label }}
            <ArrowUpRightIcon class="size-3.5" aria-hidden="true" />
          </RouterLink>
        </div>

        <div :class="cn('min-w-0', index % 2 === 1 && 'lg:order-1')">
          <HomeCode
            :code="story.snippet.code"
            :label="story.snippet.label"
            :lang="story.snippet.lang"
            :note="story.snippet.note"
          />
        </div>
      </article>
    </div>
  </section>
</template>
