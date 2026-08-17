<script setup lang="ts">
import { ArrowUpRightIcon, SaveIcon, Table2Icon, WorkflowIcon } from '@lucide/vue';
import { vReveal } from './use-reveal';

defineOptions({ name: 'HomeCapabilities' });

const capabilities = [
  {
    icon: Table2Icon,
    title: '可编辑表格',
    code: 'PLUS-TABLE COLUMNS',
    description:
      '同一份 columns 描述展示与编辑，切换 mode 即在单元格、整行与全表之间移动编辑粒度。',
    to: '/plus-table/api-overview',
  },
  {
    icon: WorkflowIcon,
    title: '字段联动引擎',
    code: 'USE-EMIT-EFFECT',
    description:
      '把「哪个字段变化、影响哪些字段」声明成规则表，销售、采购、报销三条单据共用一套引擎。',
    to: '/erp/sales-order-linkage',
  },
  {
    icon: SaveIcon,
    title: '草稿与自动保存',
    code: 'FORM PERSISTENCE',
    description: '未提交的输入落到本地，自动保存按节奏静默提交，保存动作收敛到一个快捷键。',
    to: '/composables/use-form-draft',
  },
] as const;
</script>

<template>
  <section class="mx-auto w-full max-w-[1200px] px-6 py-24 lg:py-32">
    <div v-reveal class="mx-auto max-w-2xl text-center">
      <p
        class="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 font-mono text-[10.5px] font-medium tracking-[0.14em] text-muted-foreground"
      >
        TABLE + LINK + DRAFT
      </p>

      <h2
        class="mt-6 text-[clamp(1.75rem,3.6vw,2.4rem)] leading-[1.2] font-semibold tracking-[-0.02em]"
      >
        <span class="font-mono tracking-[0.02em] text-[var(--brand)]">WORKBENCH</span>
        让复杂单据在一屏里录完
      </h2>

      <p class="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
        表格是复杂录入的主场。<br class="hidden sm:block" />
        编辑、联动、保存拆成三层能力，各自独立可用，叠起来就是一张能干活的单据。
      </p>
    </div>

    <div class="mt-12 grid gap-4 md:grid-cols-3">
      <RouterLink
        v-for="(capability, index) in capabilities"
        :key="capability.to"
        v-reveal="index * 90"
        :to="capability.to"
        class="group flex flex-col rounded-xl border border-border bg-background p-6 transition-colors hover:border-[var(--brand)]/45"
      >
        <component :is="capability.icon" class="size-5 text-[var(--brand)]" aria-hidden="true" />

        <h3 class="mt-5 text-[17px] font-semibold tracking-[-0.01em]" v-text="capability.title" />
        <p
          class="mt-1.5 font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted-foreground"
          v-text="capability.code"
        />
        <p
          class="mt-4 flex-1 text-[13.5px] leading-relaxed text-muted-foreground"
          v-text="capability.description"
        />

        <span
          class="mt-6 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--brand)]"
        >
          查看示例
          <ArrowUpRightIcon
            class="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </span>
      </RouterLink>
    </div>
  </section>
</template>
