<script setup lang="ts">
import { ref } from 'vue';
import { ElButton, ElMessage, ElTag } from 'element-plus';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import { Filters, type FilterSchemaField } from '@/components/filters';

defineOptions({ name: 'FiltersPresetDemo' });

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

/** 预设：键顺序决定挂载时槽位填充顺序 */
const presets: Record<string, { label: string; values: Record<string, unknown> }> = {
  empty: { label: '空', values: {} },
  todo: {
    label: '待办清单',
    values: { keyword: '报销', status: 'todo', enabled: true },
  },
  finance: {
    label: '财务筛选',
    values: { amount: 1000, dueDate: '2026-07-31', status: 'doing' },
  },
  dense: {
    label: '多字段',
    values: {
      keyword: '订单',
      status: 'done',
      amount: 500,
      dueDate: '2026-08-15',
      enabled: false,
    },
  },
};

const activePreset = ref('todo');
const remountKey = ref(0);
const query = ref<Record<string, unknown>>({ ...presets.todo.values });
const lastSearch = ref<Record<string, unknown> | null>(null);

function applyPreset(key: string) {
  const preset = presets[key];
  if (!preset) return;
  activePreset.value = key;
  query.value = { ...preset.values };
  remountKey.value += 1;
  lastSearch.value = null;
  ElMessage.success(`已应用预设「${preset.label}」`);
}

function onSearch(values: Record<string, unknown>) {
  lastSearch.value = { ...values };
  ElMessage.success(`搜索 ${Object.keys(values).length} 个字段`);
}

function onReset() {
  lastSearch.value = null;
  activePreset.value = 'empty';
  ElMessage.info('已重置');
}
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      通过 <code>v-model</code> 传入初始值：挂载时按
      <code>Object.keys(modelValue)</code> 顺序把合法字段填入槽位。完整 API 见「API Overview」。
    </template>

    <template #api>
      <DemoApiTable title="预设相关行为" :headers="['项', '说明']">
        <tr>
          <td>初始槽位</td>
          <td>
            挂载且槽位尚空时，按 <code>Object.keys(v-model)</code> 顺序匹配
            <code>schema.fieldName</code>，依次写入前若干槽。
          </td>
        </tr>
        <tr>
          <td>切换预设</td>
          <td>
            仅改 <code>v-model</code> 不会重排已占用槽位；本页用
            <code>:key</code> 强制重挂载以重新跑初始化。
          </td>
        </tr>
        <tr>
          <td>键顺序</td>
          <td>对象字面量插入顺序即槽位填充顺序（与 schema 声明顺序无关）。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock title="预设值">
      <template #hint>
        点击下方标签切换预设；组件会按预设键顺序自动选中对应槽位并填入值。
      </template>

      <div class="filters-demo__presets">
        <span class="filters-demo__label">预设</span>
        <ElTag
          v-for="(preset, key) in presets"
          :key="key"
          class="filters-demo__preset-tag"
          :effect="activePreset === key ? 'dark' : 'plain'"
          :type="activePreset === key ? 'primary' : 'info'"
          round
          @click="applyPreset(key)"
        >
          {{ preset.label }}
        </ElTag>
      </div>

      <Filters
        :key="remountKey"
        v-model="query"
        :schema="schema"
        @search="onSearch"
        @reset="onReset"
      >
        <ElButton size="small" @click="applyPreset('todo')">恢复「待办清单」</ElButton>
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
.filters-demo__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}

.filters-demo__preset-tag {
  cursor: pointer;
}

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

.filters-demo__presets .filters-demo__label {
  margin-bottom: 0;
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
