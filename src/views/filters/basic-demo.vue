<script setup lang="ts">
import { ref } from 'vue';
import { ElButton, ElMessage } from 'element-plus';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import { Filters, type FilterSchemaField } from '@/components/filters';

defineOptions({ name: 'FiltersBasicDemo' });

const statusOptions = [
  { label: '待办', value: 'todo' },
  { label: '进行中', value: 'doing' },
  { label: '完成', value: 'done' },
];

const schema: FilterSchemaField[] = [
  { fieldName: 'keyword', label: '关键词', component: 'input' },
  {
    fieldName: 'status',
    label: '状态',
    component: 'select',
    componentProps: { options: statusOptions, clearable: true, placeholder: '请选择状态' },
  },
  {
    fieldName: 'amount',
    label: '金额',
    component: 'input-number',
    componentProps: { min: 0, step: 100, controls: false },
  },
  {
    fieldName: 'dueDate',
    label: '截止日期',
    component: 'date-picker',
    componentProps: { type: 'date', valueFormat: 'YYYY-MM-DD', placeholder: '选择日期' },
  },
  {
    fieldName: 'enabled',
    label: '启用',
    component: 'switch',
  },
];

const query = ref<Record<string, unknown>>({});
const lastSearch = ref<Record<string, unknown> | null>(null);

function onSearch(values: Record<string, unknown>) {
  lastSearch.value = { ...values };
  ElMessage.success(`搜索 ${Object.keys(values).length} 个字段`);
}

function onReset() {
  lastSearch.value = null;
  ElMessage.info('已重置');
}

function onExport() {
  ElMessage.info('默认插槽：导出');
}
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      可配置槽位筛选：每个槽位先选字段，再填值；字段互斥。完整 API 见「API Overview」。
    </template>

    <template #api>
      <DemoApiTable title="Filters Props（本页用到）">
        <tr>
          <td><code>schema</code></td>
          <td><code>FilterSchemaField[]</code></td>
          <td>可选字段列表。</td>
        </tr>
        <tr>
          <td><code>v-model</code></td>
          <td><code>Record&lt;string, unknown&gt;</code></td>
          <td>筛选值对象。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Events（本页用到）" :headers="['名称', '载荷', '说明']">
        <tr>
          <td><code>search</code></td>
          <td><code>values</code></td>
          <td>搜索时抛出当前筛选值副本。</td>
        </tr>
        <tr>
          <td><code>reset</code></td>
          <td>—</td>
          <td>重置后触发。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Slots（本页用到）" :headers="['名称', '说明']">
        <tr>
          <td>默认插槽</td>
          <td>操作行左侧；本页放「导出」按钮。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock title="基础筛选">
      <template #hint>
        选择「键」绑定字段再填值。操作行整宽左右布局：默认插槽在左，重置 / 搜索在右。
      </template>

      <Filters v-model="query" :schema="schema" @search="onSearch" @reset="onReset">
        <ElButton @click="onExport">导出</ElButton>
      </Filters>

      <div class="filters-demo__preview">
        <div>
          <div class="filters-demo__label">v-model</div>
          <pre>{{ query }}</pre>
        </div>
        <div>
          <div class="filters-demo__label">最近一次 search</div>
          <pre>{{ lastSearch ?? '—' }}</pre>
        </div>
      </div>
    </DemoBlock>
  </DemoPage>
</template>

<style scoped>
.filters-demo__preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

.filters-demo__label {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--muted-foreground);
}

.filters-demo__preview pre {
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--muted);
  border-radius: 8px;
}

@media (max-width: 768px) {
  .filters-demo__preview {
    grid-template-columns: 1fr;
  }
}
</style>
