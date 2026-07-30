<script setup lang="ts">
import { computed, ref } from 'vue';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import { defineColumns, PlusTable, type AdaptiveConfig } from '@/components/plus-table';

defineOptions({ name: 'AdaptiveHeightDemo' });

interface Row {
  id: number;
  name: string;
  owner: string;
  status: string;
}

const statusOptions = [
  { label: '待办', value: 'todo' },
  { label: '进行中', value: 'doing' },
  { label: '完成', value: 'done' },
];

const allRows = ref<Row[]>(
  Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    name: `任务 ${i + 1}`,
    owner: i % 2 === 0 ? 'Alice' : 'Bob',
    status: (['todo', 'doing', 'done'] as const)[i % 3],
  })),
);

const columns = defineColumns<Row>([
  { type: 'index', label: '#', width: 60 },
  {
    prop: 'name',
    label: '名称',
    minWidth: 160,
    editable: true,
    component: 'input',
  },
  {
    prop: 'owner',
    label: '负责人',
    width: 140,
    editable: true,
    component: 'input',
  },
  {
    prop: 'status',
    label: '状态',
    width: 140,
    editable: true,
    component: 'select',
    componentProps: { options: statusOptions, clearable: true },
    formatter: (row) => statusOptions.find((o) => o.value === row.status)?.label ?? row.status,
  },
]);

/** viewport：按视口剩余空间算 height */
const offsetBottom = ref(16);
const minHeight = ref(200);
const viewportAdaptive = computed<AdaptiveConfig>(() => ({
  mode: 'viewport',
  offsetBottom: offsetBottom.value,
  minHeight: minHeight.value,
}));

/** container：交给固定高度 flex 父级撑满 */
const containerHeight = ref(360);
const containerAdaptive: AdaptiveConfig = { mode: 'container' };

const page = ref(1);
const pageSize = ref(20);
const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return allRows.value.slice(start, start + pageSize.value);
});
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      <code>adaptive</code> 让表体占满剩余高度并在内部滚动。默认
      <code>mode: 'viewport'</code>（按窗口剩余空间计算）；卡片 / 弹窗 / 分栏等自身高度受限时用
      <code>mode: 'container'</code>，父级需有明确高度并作为 flex 列容器。
    </template>

    <template #api>
      <DemoApiTable title="PlusTable Props">
        <tr>
          <td><code>adaptive</code></td>
          <td><code>boolean | AdaptiveConfig</code></td>
          <td>
            默认 <code>false</code>。传 <code>true</code> 等同 <code>{ mode: 'viewport' }</code>。
          </td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="AdaptiveConfig">
        <tr>
          <td><code>mode</code></td>
          <td><code>'viewport' | 'container'</code></td>
          <td>
            默认 <code>viewport</code>。container 时 height 为 <code>100%</code>，由 CSS flex
            父级撑满。
          </td>
        </tr>
        <tr>
          <td><code>offsetBottom</code></td>
          <td><code>number</code></td>
          <td>默认 <code>16</code>。表底到视口底的预留间距；仅 viewport。</td>
        </tr>
        <tr>
          <td><code>minHeight</code></td>
          <td><code>number</code></td>
          <td>默认 <code>200</code>。计算出的最小高度；仅 viewport。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock title="Viewport 模式">
      <template #hint>
        按视口剩余高度赋值给底层 <code>el-table</code>；改窗口大小或下方 <code>offsetBottom</code> /
        <code>minHeight</code> 可观察变化。有分页时会扣除底栏高度。
      </template>
      <div class="adaptive-demo__controls">
        <label class="adaptive-demo__control">
          <span>offsetBottom</span>
          <el-input-number v-model="offsetBottom" :min="0" :max="120" :step="4" size="small" />
        </label>
        <label class="adaptive-demo__control">
          <span>minHeight</span>
          <el-input-number v-model="minHeight" :min="120" :max="480" :step="20" size="small" />
        </label>
      </div>
      <PlusTable
        :data="pageRows"
        :columns="columns"
        row-key="id"
        mode="cell"
        border
        :adaptive="viewportAdaptive"
        :total="allRows.length"
        v-model:page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 40]"
      >
        <template #title>Viewport · 任务列表</template>
        <template #summary>
          <span class="demo__meta"
            >共 {{ allRows.length }} 行 · 当前页 {{ pageRows.length }} 条</span
          >
        </template>
      </PlusTable>
    </DemoBlock>

    <DemoBlock title="Container 模式">
      <template #hint>
        模拟卡片容器：父级固定高度 +
        <code>display: flex; flex-direction: column</code>，表格
        <code>:adaptive="{ mode: 'container' }"</code> 撑满剩余空间。拖动滑块改容器高度。
      </template>
      <div class="adaptive-demo__controls">
        <label class="adaptive-demo__control adaptive-demo__control--grow">
          <span>容器高度 {{ containerHeight }}px</span>
          <el-slider v-model="containerHeight" :min="220" :max="560" :step="10" />
        </label>
      </div>
      <div class="adaptive-demo__shell" :style="{ height: `${containerHeight}px` }">
        <PlusTable
          :data="allRows"
          :columns="columns"
          row-key="id"
          mode="cell"
          border
          :adaptive="containerAdaptive"
        >
          <template #title>Container · 卡片内表格</template>
          <template #toolbar>
            <span class="demo__meta">height: 100%</span>
          </template>
        </PlusTable>
      </div>
    </DemoBlock>
  </DemoPage>
</template>

<style scoped>
.adaptive-demo__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin-bottom: 16px;
}

.adaptive-demo__control {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--ink-soft);
}

.adaptive-demo__control--grow {
  flex: 1 1 280px;
  min-width: 0;
}

.adaptive-demo__control--grow :deep(.el-slider) {
  flex: 1;
  margin-right: 8px;
}

.adaptive-demo__shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px dashed var(--border);
  border-radius: var(--radius-xs);
  padding: 12px;
  background: var(--muted);
}

.adaptive-demo__shell :deep(.plus-table) {
  flex: 1;
  min-height: 0;
}
</style>
