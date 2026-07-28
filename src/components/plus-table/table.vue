<script setup lang="ts" generic="T extends RowData = RowData">
import { computed, provide, ref, useId, useSlots } from 'vue';
import { ElPagination, ElTable } from 'element-plus';
import './styles/index.scss';
import { PLUS_TABLE_INJECTION_KEY } from './tokens';
import { createStore } from './store/helper';
import { createTableExpose } from './table/expose-helper';
import { useEvents } from './table/events-helper';
import { useKeyboard } from './table/keyboard-helper';
import { useStyle } from './table/style-helper';
import PlusTableColumnSettings from './table-column-settings/index.vue';
import PlusTableColumnNode from './table-column';
import { DEFAULT_PROPS } from './table/defaults';
import type { TableInstance } from 'element-plus';
import type { PlusTable } from './tokens';
import type { TableHost } from './store/context';
import type { EditorSlotProps, HeaderSlotProps } from './table-cell/render-helper';
import type { PlusTableEmits, PlusTableProps, RowData } from './table/defaults';
import type { CellContext } from './table-column/defaults';

defineOptions({ name: 'PlusTable', inheritAttrs: false });

const props = withDefaults(defineProps<PlusTableProps<T>>(), DEFAULT_PROPS);

const emit = defineEmits<PlusTableEmits<T>>();
const slots = useSlots();

/**
 * header-${prop} / editor-${prop} 是按列 prop 动态生成的插槽名，模板里不会字面出现，
 * 只能靠显式声明让消费方在使用处获得类型提示。
 */
defineSlots<{
  title?: () => unknown;
  summary?: () => unknown;
  toolbar?: () => unknown;
  empty?: () => unknown;
  [key: `cell-${string}`]: (props: CellContext<T>) => unknown;
  [key: `header-${string}`]: (props: HeaderSlotProps<T>) => unknown;
  [key: `editor-${string}`]: (props: EditorSlotProps<T>) => unknown;
}>();

/**
 * 把 rowKey / colId 收敛成 id 片段：[A-Za-z0-9] 原样保留，其余字符转义成 `_<码点 base36>_`。
 * 转义标记 `_` 自身也在被转义之列，所以映射是单射的；输出不含 `-`，拼接时用 `-` 作分隔符，
 * 不同的 rowKey / colId 组合不会撞出同一个 id。
 */
function idPart(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, (char) => `_${char.charCodeAt(0).toString(36)}_`);
}

const idPrefix = `ptbl-${idPart(useId())}`;
const ids = {
  description: `${idPrefix}-description`,
  cell: (rowKey: string, colId: string) => `${idPrefix}-cell-${idPart(rowKey)}-${idPart(colId)}`,
  error: (rowKey: string, colId: string) => `${idPrefix}-error-${idPart(rowKey)}-${idPart(colId)}`,
};

const gridRef = ref<HTMLElement>();
const paginationRef = ref<HTMLElement>();
const tableRef = ref<TableInstance>();

const host: TableHost<T> = {
  props,
  emit,
  slots,
  gridRef,
  paginationRef,
  ids,
};
const store = createStore<T>(host);
const table: PlusTable<T> = { ...host, store };
provide(PLUS_TABLE_INJECTION_KEY, table);

const style = useStyle(table);
const events = useEvents(table);
const keyboard = useKeyboard(table);

const displayTree = store.states.originColumns;
const tableData = store.states.data;
const tableHeight = style.tableHeight;
const isAdaptiveContainer = style.isContainerMode;
const activeCellId = computed(() => {
  const cell = store.getCurrentCellLocation();
  return cell ? ids.cell(cell.rowKey, cell.node.id) : undefined;
});

// el-table 的 row-key 类型签名比本组件窄（函数变体只接受返回 string），做一次适配
const rowKeyProp = computed(() => props.rowKey as string | ((row: T) => string));

const paginationEnabled = computed(() => props.total !== undefined);

const footerEnabled = computed(() => !!slots.summary || paginationEnabled.value);

defineExpose(
  createTableExpose(
    {
      /** 全表校验 */
      validate: store.validate,
      clearValidate: store.clearValidate,
      getErrors: store.getErrors,
      /** 行操作 */
      insertRow: store.insertRow,
      removeRow: store.removeRow,
      moveRow: store.moveRow,
      duplicateRow: store.duplicateRow,
      /** row 模式行编辑 */
      startRowEdit: store.startRowEdit,
      commitRowEdit: store.commitRowEdit,
      cancelRowEdit: store.cancelRowEdit,
      /** cell 模式单元格编辑 */
      startEdit: store.startEdit,
      cancelEdit: store.cancelEdit,
      // 内部按 E-P 命名为 setCurrentCell；公开 API 继续保留 setActiveCell。
      setActiveCell: store.setCurrentCell,
      /** 列设置 */
      resetColumnSettings: store.resetSettings,
      setColumnWidth: store.setColumnWidth,
      /** 撤销重做（history prop 关闭时栈恒为空，undo/redo 为安全空操作） */
      undo: store.undo,
      redo: store.redo,
      canUndo: store.canUndo,
      canRedo: store.canRedo,
      clearHistory: store.clearHistory,
      /** 脏行 / 脏格追踪（dirtyTracking prop 关闭时恒无脏格） */
      getModifiedRows: store.getModifiedRows,
      getDirtyCells: store.getDirtyCells,
      isCellDirty: store.isCellDirty,
      isRowDirty: store.isRowDirty,
      resetTracking: store.resetTracking,
      clearDirty: store.clearDirty,
    },
    tableRef,
  ),
);
</script>

<template>
  <div class="plus-table" :class="{ 'plus-table--adaptive-container': isAdaptiveContainer }">
    <div class="plus-table__header">
      <div v-if="$slots.title" class="plus-table__title">
        <slot name="title" />
      </div>
      <div class="plus-table__toolbar">
        <slot name="toolbar" />
        <PlusTableColumnSettings />
      </div>
    </div>

    <div
      ref="gridRef"
      class="plus-table__grid"
      tabindex="0"
      :aria-describedby="ids.description"
      :aria-activedescendant="activeCellId"
      @keydown="keyboard.handleKeydown"
    >
      <span :id="ids.description" class="ptbl-visually-hidden">
        使用方向键或 Tab 在数据单元格间移动；按 Enter 或 F2 开始编辑，编辑时按 Escape 取消。
      </span>
      <el-table
        ref="tableRef"
        :data="tableData"
        :row-key="rowKeyProp"
        :height="tableHeight"
        v-bind="$attrs"
        @cell-click="events.handleCellClick"
        @cell-dblclick="events.handleCellDblclick"
        @header-dragend="events.handleHeaderDragend"
      >
        <PlusTableColumnNode
          v-for="(node, index) in displayTree"
          :key="`${index}:${node.id}`"
          :node="node"
        />
        <template v-if="$slots.empty" #empty>
          <slot name="empty" />
        </template>
      </el-table>
    </div>

    <div v-if="footerEnabled" ref="paginationRef" class="plus-table__footer">
      <div v-if="$slots.summary" class="plus-table__summary">
        <slot name="summary" />
      </div>
      <div v-if="paginationEnabled" class="plus-table__pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="pageSizes"
          @update:current-page="events.handlePageChange"
          @update:page-size="events.handlePageSizeChange"
        />
      </div>
    </div>
  </div>
</template>
