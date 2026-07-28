<script setup lang="ts">
import { computed, ref, unref } from 'vue';
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import { defineColumns, PlusTable } from '@/components/plus-table';

defineOptions({ name: 'HistoryDirtyDemo' });

interface Row {
  id: number;
  name: string;
  amount: number;
}

interface TableExpose {
  undo: () => unknown;
  redo: () => unknown;
  /** 经模板 ref 访问时 ComputedRef 会被解包成 boolean */
  canUndo: boolean;
  canRedo: boolean;
  getModifiedRows: () => Row[];
  resetTracking: () => void;
}

const tableRef = ref<TableExpose>();
const dirtyCount = ref(0);

const data = ref<Row[]>([
  { id: 1, name: '差旅报销', amount: 1280 },
  { id: 2, name: '办公采购', amount: 560 },
  { id: 3, name: '外包结算', amount: 9200 },
]);

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
    prop: 'amount',
    label: '金额',
    width: 140,
    align: 'right',
    editable: true,
    component: 'input-number',
    componentProps: { min: 0, step: 10, controls: false },
  },
]);

// expose 的 ComputedRef 在模板 ref 上会被解包；用 unref 兼容两种形态
const canUndo = computed(() => !!unref(tableRef.value?.canUndo));
const canRedo = computed(() => !!unref(tableRef.value?.canRedo));

function refreshDirty() {
  dirtyCount.value = tableRef.value?.getModifiedRows()?.length ?? 0;
}

function handleUndo() {
  tableRef.value?.undo();
  refreshDirty();
}

function handleRedo() {
  tableRef.value?.redo();
  refreshDirty();
}

function handleResetTracking() {
  tableRef.value?.resetTracking();
  refreshDirty();
}
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      <code>history</code> 打开撤销/重做栈（也可 <kbd>Ctrl</kbd>+<kbd>Z</kbd> /
      <kbd>Ctrl</kbd>+<kbd>Y</kbd>）。
      <code>dirtyTracking</code> 相对基线标记改过的行/格；保存成功后通常调
      <code>resetTracking()</code> 把当前数据设为新基线。
    </template>

    <template #api>
      <DemoApiTable title="PlusTable Props">
        <tr>
          <td><code>history</code></td>
          <td><code>boolean</code></td>
          <td>默认 <code>false</code>。开启单元格变更撤销/重做。</td>
        </tr>
        <tr>
          <td><code>dirty-tracking</code></td>
          <td><code>boolean</code></td>
          <td>默认 <code>false</code>。开启脏行/脏格追踪。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Expose（历史）">
        <tr>
          <td><code>undo</code> / <code>redo</code></td>
          <td><code>() =&gt; AppliedChange[]</code></td>
          <td>撤销 / 重做；关闭 history 时为空操作。</td>
        </tr>
        <tr>
          <td><code>canUndo</code> / <code>canRedo</code></td>
          <td><code>ComputedRef&lt;boolean&gt;</code></td>
          <td>是否可撤销 / 重做。</td>
        </tr>
        <tr>
          <td><code>clearHistory</code></td>
          <td><code>() =&gt; void</code></td>
          <td>清空撤销重做栈。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Expose（脏追踪）">
        <tr>
          <td><code>getModifiedRows</code></td>
          <td><code>() =&gt; T[]</code></td>
          <td>当前有脏格的行。</td>
        </tr>
        <tr>
          <td><code>getDirtyCells</code></td>
          <td><code>() =&gt; DirtyCell[]</code></td>
          <td>
            每项为
            <code>{ rowKey: string; prop: string }</code>，表示一个脏格。
          </td>
        </tr>
        <tr>
          <td><code>isCellDirty</code> / <code>isRowDirty</code></td>
          <td>谓词</td>
          <td>判断单格 / 整行是否脏。</td>
        </tr>
        <tr>
          <td><code>resetTracking</code></td>
          <td><code>() =&gt; void</code></td>
          <td>以当前 data 为新基线并清空脏标记。</td>
        </tr>
        <tr>
          <td><code>clearDirty</code></td>
          <td><code>(rowKey?, prop?) =&gt; void</code></td>
          <td>按范围清除脏标记（不改数据）。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock>
      <template #hint>
        改名称/金额 → 脏行数增加 → Undo/Redo；点 Reset tracking 后脏行清零（数据保留）。
      </template>
      <PlusTable
        ref="tableRef"
        v-model:data="data"
        :columns="columns"
        row-key="id"
        mode="cell"
        history
        dirty-tracking
        border
        @cell-change="refreshDirty"
      >
        <template #toolbar>
          <el-button :disabled="!canUndo" @click="handleUndo">Undo</el-button>
          <el-button :disabled="!canRedo" @click="handleRedo">Redo</el-button>
          <el-button @click="handleResetTracking">Reset tracking</el-button>
          <span class="demo__meta">脏行 {{ dirtyCount }}</span>
        </template>
      </PlusTable>
    </DemoBlock>
  </DemoPage>
</template>
