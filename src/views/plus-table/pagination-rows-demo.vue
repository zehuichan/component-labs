<script setup lang="ts">
import { computed, ref } from 'vue';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import { defineColumns, PlusTable, type ContextMenuItem } from '@/components/plus-table';

defineOptions({ name: 'PaginationRowsDemo' });

interface Row {
  id: number;
  name: string;
  owner: string;
}

let nextId = 21;

const allRows = ref<Row[]>(
  Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `任务 ${i + 1}`,
    owner: i % 2 === 0 ? 'Alice' : 'Bob',
  })),
);

const page = ref(1);
const pageSize = ref(5);
const selectedRows = ref<Row[]>([]);
const insertCount = ref(1);

const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return allRows.value.slice(start, start + pageSize.value);
});

const columns = defineColumns<Row>([
  { type: 'selection', width: 48 },
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
]);

function handlePageChange(payload: { page: number; pageSize: number }) {
  page.value = payload.page;
  pageSize.value = payload.pageSize;
}

function addRow() {
  allRows.value = [
    ...allRows.value,
    { id: nextId++, name: `新任务 ${nextId - 1}`, owner: 'Alice' },
  ];
  page.value = Math.ceil(allRows.value.length / pageSize.value) || 1;
}

function clampPage() {
  const maxPage = Math.max(1, Math.ceil(allRows.value.length / pageSize.value) || 1);
  if (page.value > maxPage) page.value = maxPage;
}

function removeRowById(id: number) {
  allRows.value = allRows.value.filter((row) => row.id !== id);
  clampPage();
}

function handleSelectionChange(rows: Row[]) {
  selectedRows.value = rows;
}

function removeSelectedRows() {
  if (!selectedRows.value.length) return;
  const ids = new Set(selectedRows.value.map((row) => row.id));
  allRows.value = allRows.value.filter((row) => !ids.has(row.id));
  selectedRows.value = [];
  clampPage();
}

function duplicateRowById(id: number) {
  const index = allRows.value.findIndex((row) => row.id === id);
  const source = allRows.value[index];
  if (index < 0 || !source) return;
  const clone: Row = {
    ...source,
    id: nextId++,
    name: `${source.name} (副本)`,
  };
  const next = [...allRows.value];
  next.splice(index + 1, 0, clone);
  allRows.value = next;
}

/** 在指定行后插入 N 行（改全量源） */
function insertRowsAfter(id: number, count: number) {
  const n = Math.min(100, Math.max(1, Math.floor(Number(count)) || 1));
  const index = allRows.value.findIndex((row) => row.id === id);
  if (index < 0) return;
  const inserts: Row[] = Array.from({ length: n }, () => {
    const rowId = nextId++;
    return { id: rowId, name: `新任务 ${rowId}`, owner: 'Alice' };
  });
  const next = [...allRows.value];
  next.splice(index + 1, 0, ...inserts);
  allRows.value = next;
  insertCount.value = 1;
}

function confirmInsert(row: Row, close: () => void) {
  insertRowsAfter(row.id, insertCount.value);
  close();
}

function onInsertItemClick(event: MouseEvent, row: Row, close: () => void) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('.el-input-number, input')) return;
  confirmInsert(row, close);
}

function clampInsertCount(value: number | undefined) {
  insertCount.value = Math.min(100, Math.max(1, Math.floor(Number(value)) || 1));
}

function removeFirstOnPage() {
  const first = pageRows.value[0];
  if (!first) return;
  removeRowById(first.id);
}

function duplicateFirstOnPage() {
  const first = pageRows.value[0];
  if (!first) return;
  duplicateRowById(first.id);
}

/** 菜单项含勾选数量，用函数形式让每次右键都重新解析 */
function contextMenu(): ContextMenuItem<Row>[] {
  const selectedCount = selectedRows.value.length;
  return [
    {
      key: 'add',
      label: '新增一行',
      handler: () => addRow(),
    },
    {
      key: 'duplicate',
      label: '复制此行',
      handler: ({ row }) => duplicateRowById(row.id),
    },
    {
      key: 'insert-n',
      label: '插入行',
      // 内容由 #context-menu-item-insert-n 提供；壳不自动关，由插槽内 close
      closeOnSelect: false,
      separator: true,
      handler: ({ row }) => insertRowsAfter(row.id, insertCount.value),
    },
    {
      key: 'remove',
      label: '删除此行',
      handler: ({ row }) => removeRowById(row.id),
    },
    {
      key: 'remove-selected',
      label: `删除勾选行${selectedCount ? ` (${selectedCount})` : ''}`,
      disabled: !selectedCount,
      handler: () => removeSelectedRows(),
    },
  ];
}
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      传入 <code>total</code> 即启用分页 UI；组件<strong>不切片</strong>，由业务把当前页数据塞进
      <code>data</code>（服务端分页同理）。本页用内存全量 +
      <code>computed</code> 切片演示。行增删改请改全量源，不要对当前页数组调
      <code>insertRow</code>（否则只动这一页）。表体右键菜单通过
      <code>context-menu</code> 声明动作项，自定义内容用
      <code>#context-menu-item-${'{key}'}</code> 插槽（对齐 <code>#cell-*</code> /
      <code>#editor-*</code>）。
    </template>

    <template #api>
      <DemoApiTable title="PlusTable Props（分页）">
        <tr>
          <td><code>total</code></td>
          <td><code>number</code></td>
          <td>传入即显示分页；总条数（服务端返回）。</td>
        </tr>
        <tr>
          <td><code>page</code> / <code>v-model:page</code></td>
          <td><code>number</code></td>
          <td>默认 <code>1</code>。当前页。</td>
        </tr>
        <tr>
          <td><code>page-size</code> / <code>v-model:pageSize</code></td>
          <td><code>number</code></td>
          <td>默认 <code>20</code>。每页条数。</td>
        </tr>
        <tr>
          <td><code>page-sizes</code></td>
          <td><code>number[]</code></td>
          <td>默认 <code>[10, 20, 50, 100]</code>。</td>
        </tr>
        <tr>
          <td><code>context-menu</code></td>
          <td><code>ContextMenuItem[] | (ctx) =&gt; ContextMenuItem[]</code></td>
          <td>
            表体右键动作列表；自定义项内容用
            <code>#context-menu-item-${'{key}'}</code>，内嵌控件时设
            <code>closeOnSelect: false</code>。
          </td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Events" :headers="['名称', '载荷', '说明']">
        <tr>
          <td><code>update:page</code> / <code>update:pageSize</code></td>
          <td><code>number</code></td>
          <td>分页控件变更。</td>
        </tr>
        <tr>
          <td><code>page-change</code></td>
          <td><code>{ page, pageSize }</code></td>
          <td>页码或 pageSize 变化时一并抛出，便于拉数。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Expose（行操作，作用于传入的 data）" :headers="['名称', '说明']">
        <tr>
          <td><code>insertRow(row, index?)</code></td>
          <td>插入行并 <code>update:data</code>。</td>
        </tr>
        <tr>
          <td><code>removeRow(index)</code></td>
          <td>按当前 <code>data</code> 下标删除。</td>
        </tr>
        <tr>
          <td><code>duplicateRow(index, patch)</code></td>
          <td>复制行；须用 <code>patch</code> 覆盖新 <code>rowKey</code>。</td>
        </tr>
        <tr>
          <td><code>moveRow(from, to)</code></td>
          <td>移动行。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Slots" :headers="['名称', '说明']">
        <tr>
          <td><code>#title</code></td>
          <td>顶栏左侧标题区，与 toolbar 同一行（有 title 或 toolbar 时显示顶栏）。</td>
        </tr>
        <tr>
          <td><code>#summary</code></td>
          <td>
            底栏左侧汇总区；有分页时与分页同一行，无
            <code>total</code> 时仍可单独显示。
          </td>
        </tr>
        <tr>
          <td><code>#context-menu-item-${'{key}'}</code></td>
          <td>
            右键菜单项自定义内容；参数为
            <code>ContextMenuItemSlotProps</code>（含 <code>close</code>）。
          </td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock>
      <template #hint>
        右键「插入 N 行」：改数字后点输入框以外区域或回车插入；勾选后可批量删除。翻页 / toolbar
        与菜单均改 <code>allRows</code>。表头右键可隐藏列 / 打开列设置。
      </template>
      <PlusTable
        :data="pageRows"
        :columns="columns"
        row-key="id"
        mode="cell"
        border
        :total="allRows.length"
        :page="page"
        :page-size="pageSize"
        :page-sizes="[5, 10, 20]"
        :context-menu="contextMenu"
        @selection-change="handleSelectionChange"
        @update:page="page = $event"
        @update:page-size="pageSize = $event"
        @page-change="handlePageChange"
      >
        <template #title>任务列表</template>
        <template #toolbar>
          <el-button type="primary" @click="addRow">新增</el-button>
          <el-button
            type="danger"
            plain
            :disabled="!selectedRows.length"
            @click="removeSelectedRows"
          >
            删除勾选行{{ selectedRows.length ? ` (${selectedRows.length})` : '' }}
          </el-button>
          <el-button @click="removeFirstOnPage">删除当前页首行</el-button>
          <el-button @click="duplicateFirstOnPage">复制当前页首行</el-button>
        </template>
        <template #summary>
          <span class="demo__meta"
            >共 {{ allRows.length }} 行 · 当前页 {{ pageRows.length }} 条</span
          >
        </template>
        <template #context-menu-item-insert-n="{ row, close }">
          <div @click="onInsertItemClick($event, row, close)">
            插入
            <el-input-number
              :model-value="insertCount"
              :min="1"
              :max="100"
              size="small"
              :controls="false"
              style="width: 5cqw"
              @update:model-value="clampInsertCount"
              @keydown.enter.stop="confirmInsert(row, close)"
            />
            行
          </div>
        </template>
      </PlusTable>
    </DemoBlock>
  </DemoPage>
</template>
