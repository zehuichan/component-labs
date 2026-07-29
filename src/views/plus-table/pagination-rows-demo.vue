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

const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return allRows.value.slice(start, start + pageSize.value);
});

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

function removeRowById(id: number) {
  allRows.value = allRows.value.filter((row) => row.id !== id);
  const maxPage = Math.max(1, Math.ceil(allRows.value.length / pageSize.value));
  if (page.value > maxPage) page.value = maxPage;
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

const contextMenu: ContextMenuItem<Row>[] = [
  {
    key: 'add',
    label: '新增一行',
    handler: () => addRow(),
  },
  {
    key: 'duplicate',
    label: '复制此行',
    separator: true,
    handler: ({ row }) => duplicateRowById(row.id),
  },
  {
    key: 'remove',
    label: '删除此行',
    handler: ({ row }) => removeRowById(row.id),
  },
];
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      传入 <code>total</code> 即启用分页 UI；组件<strong>不切片</strong>，由业务把当前页数据塞进
      <code>data</code>（服务端分页同理）。本页用内存全量 +
      <code>computed</code> 切片演示。行增删改请改全量源，不要对当前页数组调
      <code>insertRow</code>（否则只动这一页）。表体右键菜单通过
      <code>context-menu</code> 配置，同样操作全量源。
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
          <td>表体自定义右键菜单；空则保留浏览器原生菜单。</td>
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
      </DemoApiTable>
    </template>

    <DemoBlock>
      <template #hint>
        翻页 / 改 pageSize；toolbar 与表体右键菜单均可增删复制，改的是
        <code>allRows</code>。表头右键可隐藏列 / 打开列设置。
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
        @update:page="page = $event"
        @update:page-size="pageSize = $event"
        @page-change="handlePageChange"
      >
        <template #title>任务列表</template>
        <template #toolbar>
          <el-button type="primary" @click="addRow">新增</el-button>
          <el-button @click="removeFirstOnPage">删除当前页首行</el-button>
          <el-button @click="duplicateFirstOnPage">复制当前页首行</el-button>
        </template>
        <template #summary>
          <span class="demo__meta"
            >共 {{ allRows.length }} 行 · 当前页 {{ pageRows.length }} 条</span
          >
        </template>
      </PlusTable>
    </DemoBlock>
  </DemoPage>
</template>
