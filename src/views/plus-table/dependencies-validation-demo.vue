<script setup lang="ts">
import { ref } from 'vue';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import { defineColumns, PlusTable } from '@/components/plus-table';
import type { ValidateResult } from '@/components/plus-table';

defineOptions({ name: 'DependenciesValidationDemo' });

interface Row {
  id: number;
  category: string;
  item: string;
  remark: string;
}

const CATEGORY_ITEMS: Record<string, { label: string; value: string }[]> = {
  hardware: [
    { label: '显示器', value: 'monitor' },
    { label: '键盘', value: 'keyboard' },
  ],
  software: [
    { label: 'IDE 许可', value: 'ide' },
    { label: '云服务', value: 'cloud' },
  ],
};

const tableRef = ref<{ validate: () => Promise<ValidateResult> }>();
const lastValidate = ref('');

const data = ref<Row[]>([
  { id: 1, category: 'hardware', item: 'monitor', remark: '27 寸' },
  { id: 2, category: 'software', item: 'ide', remark: '' },
  { id: 3, category: '', item: '', remark: '' },
]);

const columns = defineColumns<Row>([
  { type: 'index', label: '#', width: 60 },
  {
    prop: 'category',
    label: '类别',
    width: 160,
    editable: true,
    required: true,
    rules: [{ required: true, message: '请选择类别' }],
    component: 'select',
    componentProps: {
      options: [
        { label: '硬件', value: 'hardware' },
        { label: '软件', value: 'software' },
      ],
      clearable: true,
    },
    formatter: (row) =>
      (({ hardware: '硬件', software: '软件' }) as Record<string, string>)[row.category] ?? '',
  },
  {
    prop: 'item',
    label: '明细',
    width: 160,
    editable: true,
    required: true,
    rules: [{ required: true, message: '请选择明细' }],
    component: 'select',
    componentProps: { clearable: true },
    dependencies: {
      triggerFields: ['category'],
      componentProps: (row) => ({
        options: CATEGORY_ITEMS[row.category] ?? [],
        disabled: !row.category,
      }),
      trigger: (row, api) => {
        const options = CATEGORY_ITEMS[row.category] ?? [];
        if (!options.some((o) => o.value === row.item)) {
          api.setValue('item', '');
        }
      },
    },
    formatter: (row) => {
      const options = CATEGORY_ITEMS[row.category] ?? [];
      return options.find((o) => o.value === row.item)?.label ?? row.item;
    },
  },
  {
    prop: 'remark',
    label: '备注',
    minWidth: 160,
    editable: true,
    component: 'input',
  },
]);

async function handleValidate() {
  const result = await tableRef.value?.validate();
  if (!result) {
    lastValidate.value = '无法校验';
    return;
  }
  lastValidate.value = result.valid ? '校验通过' : `失败 ${result.errors.length} 项`;
}
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      列上的 <code>dependencies</code> 按 <code>triggerFields</code> 响应同行其他字段变化（动态
      options / disabled、副作用清空）。静态 <code>required</code> / <code>rules</code> 做校验；也可
      <code>ref.validate()</code> 全表校验。第 3 行故意留空便于看失败提示。
    </template>

    <template #api>
      <DemoApiTable title="Column 校验 / 联动">
        <tr>
          <td><code>required</code></td>
          <td><code>boolean</code></td>
          <td>静态必填（格内会标示）。</td>
        </tr>
        <tr>
          <td><code>rules</code></td>
          <td><code>RuleItem[]</code></td>
          <td>async-validator 规则；与联动动态 rules 合并。</td>
        </tr>
        <tr>
          <td><code>dependencies</code></td>
          <td><code>ColumnDependencies</code></td>
          <td>字段联动配置，见下表。</td>
        </tr>
        <tr>
          <td><code>validateEvent</code></td>
          <td><code>boolean</code></td>
          <td>
            表级 prop，默认 <code>true</code>。为 false 时仅 <code>validate()</code> 触发校验。
          </td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="dependencies">
        <tr>
          <td><code>triggerFields</code></td>
          <td><code>string[]</code></td>
          <td>必填。这些字段变更时跑 <code>trigger</code> 副作用。</td>
        </tr>
        <tr>
          <td><code>componentProps</code></td>
          <td><code>(row, api) =&gt; Record</code></td>
          <td>动态编辑器 props（如下拉 options / disabled）。</td>
        </tr>
        <tr>
          <td><code>trigger</code></td>
          <td><code>(row, api) =&gt; void</code></td>
          <td>副作用；用 <code>api.setValue(prop, value)</code> 改同行其他字段。</td>
        </tr>
        <tr>
          <td><code>disabled</code> / <code>required</code> / <code>rules</code></td>
          <td>函数</td>
          <td>可选。按行动态禁用、必填、规则。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Expose">
        <tr>
          <td><code>validate</code></td>
          <td><code>() =&gt; Promise&lt;ValidateResult&gt;</code></td>
          <td>全表校验；返回 <code>{ valid, errors }</code>。</td>
        </tr>
        <tr>
          <td><code>clearValidate</code> / <code>getErrors</code></td>
          <td>—</td>
          <td>清空 / 读取当前错误。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock>
      <template #hint>
        改「类别」→「明细」选项切换，非法明细会被清空。点「校验」看第 3 行空必填失败。
      </template>
      <PlusTable
        ref="tableRef"
        v-model:data="data"
        :columns="columns"
        row-key="id"
        mode="cell"
        border
      >
        <template #toolbar>
          <el-button type="primary" @click="handleValidate">校验</el-button>
          <span v-if="lastValidate" class="demo__meta">{{ lastValidate }}</span>
        </template>
      </PlusTable>
    </DemoBlock>
  </DemoPage>
</template>
