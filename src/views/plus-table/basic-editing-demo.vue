<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import { defineColumns, PlusTable, type EditMode } from '@/components/plus-table';

defineOptions({ name: 'BasicEditingDemo' });

interface Row {
  id: number;
  name: string;
  amount: number;
  status: string;
  dueDate: string;
  enabled: boolean;
}

interface TableExpose {
  startRowEdit: (rowIndex: number) => boolean;
  commitRowEdit: (rowIndex: number) => Promise<boolean>;
  cancelRowEdit: (rowIndex: number) => void;
}

const mode = ref<EditMode>('cell');
const tableRef = ref<TableExpose>();
const editingRowId = ref<number | null>(null);

const data = ref<Row[]>([
  {
    id: 1,
    name: '需求评审',
    amount: 1200,
    status: 'todo',
    dueDate: '2026-07-20',
    enabled: true,
  },
  {
    id: 2,
    name: '接口开发',
    amount: 3400,
    status: 'doing',
    dueDate: '2026-07-25',
    enabled: true,
  },
  {
    id: 3,
    name: '联调测试',
    amount: 800,
    status: 'done',
    dueDate: '2026-07-30',
    enabled: false,
  },
]);

const statusOptions = [
  { label: '待办', value: 'todo' },
  { label: '进行中', value: 'doing' },
  { label: '完成', value: 'done' },
];

const baseColumns = defineColumns<Row>([
  { type: 'index', label: '#', width: 60 },
  {
    prop: 'name',
    label: '名称',
    minWidth: 140,
    editable: true,
    component: 'input',
  },
  {
    prop: 'amount',
    label: '金额',
    width: 120,
    align: 'right',
    editable: true,
    component: 'input-number',
    componentProps: { min: 0, step: 100, controls: false },
    formatter: (row) => `¥ ${(row.amount ?? 0).toLocaleString('zh-CN')}`,
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
  {
    prop: 'dueDate',
    label: '截止日期',
    width: 160,
    editable: true,
    component: 'date-picker',
    componentProps: { type: 'date', valueFormat: 'YYYY-MM-DD' },
  },
  {
    prop: 'enabled',
    label: '启用',
    width: 90,
    align: 'center',
    editable: true,
    component: 'switch',
  },
]);

const columns = computed(() =>
  mode.value === 'row'
    ? defineColumns<Row>([
        ...baseColumns,
        {
          // 操作列不绑定行字段，prop 只用来定位 cell-actions 插槽
          prop: 'actions',
          type: 'operation',
          label: '操作',
          width: 140,
          fixed: 'right',
        },
      ])
    : baseColumns,
);

const modeHints: Record<EditMode, string> = {
  none: '当前为只读：不可进入编辑。',
  cell: '单击选中格子 → 方向键移动；双击或按 Enter 进编；select / switch 选值后会自动提交并把焦点交回网格。',
  row: '双击或点「编辑」进入整行；改完后点「保存」提交，或「取消」回滚。Escape 也可取消。',
  table: '可编辑列常驻编辑器；改值后失焦或控件自身提交即写回。',
};

const hint = computed(() => modeHints[mode.value]);

watch(mode, () => {
  editingRowId.value = null;
});

function isEditingRow(row: Row) {
  return editingRowId.value === row.id;
}

function handleEdit(row: Row, rowIndex: number) {
  tableRef.value?.startRowEdit(rowIndex);
  editingRowId.value = row.id;
}

async function handleSave(row: Row, rowIndex: number) {
  const ok = await tableRef.value?.commitRowEdit(rowIndex);
  if (ok) editingRowId.value = null;
}

function handleCancel(_row: Row, rowIndex: number) {
  tableRef.value?.cancelRowEdit(rowIndex);
  editingRowId.value = null;
}

function handleCellDblclick(row: Row) {
  if (mode.value === 'row') editingRowId.value = row.id;
}
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      用 toolbar 切换
      <code>mode</code>： <code>none</code>（只读）/ <code>cell</code>（单元格进编）/
      <code>row</code>（整行进编，含操作列）/
      <code>table</code>（全表常驻编辑器）。本页覆盖内置编辑器 <code>input</code> /
      <code>input-number</code> / <code>select</code> / <code>date-picker</code> /
      <code>switch</code>。
    </template>

    <template #api>
      <DemoApiTable title="PlusTable Props（本页用到）">
        <tr>
          <td><code>data</code> / <code>v-model:data</code></td>
          <td><code>T[]</code></td>
          <td>
            必填。表格数据；字段编辑就地修改行对象（经
            <code>cell-change</code> 通知），行结构变更（插入/删除/移动）才经
            <code>update:data</code> 回写新数组。
          </td>
        </tr>
        <tr>
          <td><code>columns</code></td>
          <td><code>PlusTableColumn&lt;T&gt;[]</code></td>
          <td>
            必填。列配置（可编辑、编辑器、格式化等）；本页用
            <code>defineColumns&lt;Row&gt;</code> 拿到行类型。
          </td>
        </tr>
        <tr>
          <td><code>row-key</code></td>
          <td><code>keyof T | (row) =&gt; string | number</code></td>
          <td>必填。行唯一标识。</td>
        </tr>
        <tr>
          <td><code>mode</code></td>
          <td><code>'none' | 'cell' | 'row' | 'table'</code></td>
          <td>默认 <code>cell</code>。本页 toolbar 可切换四种。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Column 关键字段">
        <tr>
          <td><code>prop</code></td>
          <td><code>string</code></td>
          <td>字段名；特殊列可用 <code>type: 'index' | 'selection' | …</code>。</td>
        </tr>
        <tr>
          <td><code>editable</code></td>
          <td><code>boolean | (ctx) =&gt; boolean</code></td>
          <td>是否可编辑。</td>
        </tr>
        <tr>
          <td><code>component</code></td>
          <td>
            <code>BuiltinEditorType | Component</code>
          </td>
          <td>
            编辑控件。内置：<code>input</code> / <code>textarea</code> / <code>input-number</code> /
            <code>select</code> / <code>date-picker</code> / <code>time-picker</code> /
            <code>switch</code> / <code>checkbox</code>；可用 <code>componentProps</code> 透传参数。
          </td>
        </tr>
        <tr>
          <td><code>formatter</code></td>
          <td>el-table 同名</td>
          <td>展示态格式化（编辑器用原始值）。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock>
      <template #hint>
        {{ hint }}
      </template>
      <PlusTable
        ref="tableRef"
        v-model:data="data"
        :columns="columns"
        row-key="id"
        :mode="mode"
        border
        @cell-dblclick="handleCellDblclick"
      >
        <template #toolbar>
          <el-radio-group v-model="mode" size="small">
            <el-radio-button value="none">none</el-radio-button>
            <el-radio-button value="cell">cell</el-radio-button>
            <el-radio-button value="row">row</el-radio-button>
            <el-radio-button value="table">table</el-radio-button>
          </el-radio-group>
        </template>
        <template #cell-actions="{ row, rowIndex }">
          <template v-if="isEditingRow(row)">
            <el-button type="primary" link @click.stop="handleSave(row, rowIndex)">
              保存
            </el-button>
            <el-button link @click.stop="handleCancel(row, rowIndex)"> 取消 </el-button>
          </template>
          <el-button v-else type="primary" link @click.stop="handleEdit(row, rowIndex)">
            编辑
          </el-button>
        </template>
      </PlusTable>
    </DemoBlock>
  </DemoPage>
</template>
