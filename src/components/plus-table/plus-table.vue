<template>
  <div ref="tableWrapperInstance" class="re-table" v-loading="loading">
    <el-table
      v-bind="$attrs"
      border
      highlight-current-row
      show-overflow-tooltip
      scrollbar-always-on
      :ref="changeInstance"
      :data="data"
      :row-class-name="rowClassName"
      :cell-class-name="cellClassName"
      @cell-click="handleCellClick"
    >
      <template #default>
        <slot>
          <component
            :is="h(PlusTableColumn, null, $slots)"
            :columns="refColumns"
            :rules="rules"
            :editable="editable"
          />
        </slot>
      </template>

      <!-- 插入至表格最后一行之后的内容 -->
      <template #append>
        <slot name="append" />
      </template>

      <!-- 当数据为空时自定义的内容 -->
      <template #empty>
        <slot name="empty" />
      </template>
    </el-table>
  </div>
</template>

<script setup>
import {
  computed,
  ref,
  getCurrentInstance,
  reactive,
  onMounted,
  onUnmounted,
  onDeactivated,
  provide,
  nextTick,
  h,
  watch,
  shallowRef,
} from 'vue';

import { useRoute } from 'vue-router';

import { cloneDeep, isEqual } from 'es-toolkit';
import { findIndex } from 'es-toolkit/compat';

import { getEventTargetNode, isBoolean, isFunction } from '@/utils';

import {
  IGNORE_COLUMN_FLAG,
  ORIGINAL_CELL_META,
  PLUS_TABLE_FORM_INJECTION_KEY,
  PLUS_TABLE_INJECTION_KEY,
} from './tokens';

import PlusTableColumn from './plus-table-column.vue';

const props = defineProps({
  tableKey: {
    type: [String, Number],
    default: '0',
  },
  rowKey: {
    type: [Function, String],
  },
  columns: {
    type: Array,
    default: () => [],
  },
  data: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  editable: {
    type: [Boolean, String, Object],
    default: false,
  },
  rules: {
    type: Object,
  },
});

const vm = getCurrentInstance();

const route = useRoute();

const tableKey = `table/${props.tableKey}${route.path.split('/').join('\/')}`;
const columnsKey = `columns/${props.tableKey}${route.path.split('/').join('\/')}`;

const tableWrapperInstance = ref();
const tableInstance = ref();
const paginationInstance = ref();
// 当前表格是否激活
const activated = ref(false);
const cachedData = ref([]);
// 单元格元数据
const cellMeta = ref({ ...ORIGINAL_CELL_META });

const cachedColumns = computed(() => {
  if (props.columns.length > 0) {
    return props.columns.map((column) => ({ ...column }));
  }
  return tableInstance.value.columns;
});
const refColumns = computed(() => {
  if (props.columns.length > 0) {
    return props.columns.filter((column) => hasHidden(column));
  }
  return (tableInstance.value ?? {}).columns;
});

// 行元数据
const rowMeta = computed(() => props.data[cellMeta.value.row]);
// 列元数据
const columnMeta = computed(() => refColumns.value[cellMeta.value.col]);

const hasHidden = (column) => {
  const hidden = column.hidden;
  if (isBoolean(hidden)) {
    return !hidden;
  }
  if (isFunction(hidden)) {
    return !hidden(column);
  }
  return true;
};

// 行类
const rowClassName = ({ row, rowIndex }) => {
  const classNames = [`re-table-row-${rowIndex}`];
  return classNames.join(' ');
};

// 单元格类
const cellClassName = ({ rowIndex, columnIndex }) => {
  const classNames = [`re-table-cell-${rowIndex}-${columnIndex}`];

  if (rowIndex === cellMeta.value.row && columnIndex === cellMeta.value.col) {
    classNames.push('current-cell');
  }

  if (!equalCell(rowIndex, columnIndex)) {
    classNames.push('dirty-cell');
  }

  return classNames.join(' ');
};

const equalCell = (rowIndex, columnIndex) => {
  const column = refColumns.value[columnIndex];
  const prop = column?.prop;
  if (!prop) return true;
  const rowData = props.data[rowIndex];
  const oldRowData = cachedData.value[rowIndex];
  return isEqual(rowData[prop], oldRowData[prop]);
};

const updateCell = (data) => {
  cellMeta.value = { ...cellMeta.value, ...data };
};

/**
 * 对表格中的表单进行校验
 * @param {Boolean|Array} rows - 指定校验的行数据，true表示校验所有数据，false或未传表示校验变动数据
 * @returns {Promise} 返回一个 Promise，包含校验结果
 */
const validate = async (rows = true) => {
  if (Object.keys(formRefs.value).length === 0) {
    return Promise.resolve(null);
  }

  if (rows === true) {
    rows = props.data;
  } else {
    rows = Array.isArray(rows) ? rows : [rows];
  }

  const validRest = {};

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    try {
      const da = await Promise.all(
        formRefs.value[rowIndex].map((item) => item?.validate()),
      );
      console.log(da, 'da');
    } catch (errors) {
      validRest[rowIndex] = errors;
    }
  }

  return Promise.resolve(validRest);
};

/**
 * 实现表格单元格的导航
 * @param {Number} rowDelta - 行偏移量，正数表示向下，负数表示向上
 * @param {Number} colDelta - 列偏移量，正数表示向右，负数表示向左
 * @returns {Object} 返回新的单元格位置 { row, col }
 * @description 需求1：跳过selection、index特殊列
 * @description 需求2：按下ArrowLeft键时的边界处理，导航到当前行第一列时，下一次向左导航到上一行最后一列
 * @description 需求3：按下ArrowRight键时的边界处理，导航到当前行最后一列时，下一次向右导航到下一行第一列
 * @description 需求4：按下ArrowUp键时的边界处理，导航到第一行时，下一次向上导航到最后一行
 * @description 需求5：按下ArrowDown键时的边界处理，导航到最后一行时，下一次向下导航到第一行
 */
const transformStart = (rowDelta, colDelta) => {
  const totalRows = props.data.length;
  const totalColumns = refColumns.value.length;

  if (totalRows === 0 || totalColumns === 0) {
    return {
      row: -1,
      col: -1,
    };
  }

  let { row, col } = cellMeta.value;
  let newRow = row + rowDelta;
  let newCol = col + colDelta;
  let attempts = 0;
  const maxAttempts = totalRows * totalColumns;

  while (attempts < maxAttempts) {
    // 边界处理
    if (newCol < 0) {
      newRow -= 1;
      newCol = totalColumns - 1;
    } else if (newCol >= totalColumns) {
      newRow += 1;
      newCol = 0;
    }
    if (newRow < 0) {
      newRow = totalRows - 1;
    } else if (newRow >= totalRows) {
      newRow = 0;
    }

    // 检查是否为忽略列
    if (!IGNORE_COLUMN_FLAG.includes(refColumns.value[newCol].type)) {
      return {
        row: newRow,
        col: newCol,
      };
    }

    // 继续寻找下一个有效单元格
    newRow += rowDelta;
    newCol += colDelta;
    attempts++;
  }
};

const transformEnd = (scrollIntoView) => {
  const { row, activated, editable } = cellMeta.value;

  // 聚焦输入框（如有）
  if (activated && (props.editable || editable)) {
    nextTick(() => {
      const currentCell =
        tableInstance.value.$el.querySelector('.current-cell');
      if (currentCell) {
        const input = currentCell.querySelector('input, textarea');
        if (input) {
          input.focus({ preventScroll: true });
        }
      }
    });
  }

  // 滚动到当前行
  if (scrollIntoView && row >= 0) {
    nextTick(() => {
      const rowElement = tableInstance.value.$el.querySelector(
        `.re-table-row-${row}`,
      );
      if (rowElement) {
        rowElement.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
    });
  }
};

/**
 * 处理单元格编辑事件
 * @description 需求1：忽略 selection、index 等特殊列
 * @description 需求2：props.editable = true 时，表格整体可编辑
 * @description 以下的前置需求：当前行或者当前单元格处于编辑状态时，点击行或者单元格不做任何处理
 * @description 需求3：props.editable = 'row' 时，点击行编辑
 * @description 需求4：props.editable = 'cell' 时，点击单元格编辑
 */
const handleCellClick = (row, column, cell, event) => {
  // 需求1：忽略 selection、index 等特殊列
  if (IGNORE_COLUMN_FLAG.includes(column.type)) {
    return;
  }

  const {
    row: currentRowIndex,
    col: currentColIndex,
    editable,
  } = cellMeta.value;

  const rowIndex = props.rowKey
    ? findIndex(props.data, (item) => item[props.rowKey] === row[props.rowKey])
    : findIndex(props.data, row);
  const columnIndex = column.getColumnIndex();

  const currentCell =
    currentRowIndex === rowIndex &&
    currentColIndex === columnIndex &&
    (props.editable === 'cell' || props.editable === 'manual');
  const currentRow = currentRowIndex === rowIndex && props.editable === 'row';

  // 前置需求：当前行或者当前单元格处于编辑状态时，点击行或者单元格不做任何处理
  if (currentCell || currentRow) {
    return;
  }

  let shouldEdit = editable;

  // 需求2：props.editable = true 时，表格整体可编辑
  if (props.editable === true) {
    shouldEdit = true;
  }
  // 需求3：props.editable = row 时，点击行编辑
  else if (props.editable === 'row') {
    shouldEdit = true;
  }
  // 需求4：props.editable = cell 时，点击单元格编辑
  else if (props.editable === 'cell') {
    shouldEdit = true;
  }

  updateCell({
    row: rowIndex,
    col: columnIndex,
    activated: true,
    editable: shouldEdit,
    contextmenu: event.button === 2,
  });
};

// 注册按键导航，涉及以下按键：
// ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'F2', 'Escape']
const registerGlobalKeydownEvent = (event) => {
  if (!activated.value) {
    return;
  }

  const { editable, readonly, disabled, contextmenu } = cellMeta.value;

  if (
    contextmenu &&
    [
      'Enter',
      ' ',
      'Tab',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
    ].includes(event.key)
  ) {
    return;
  }

  switch (event.key) {
    // 移动到当前活动单元格上面的单元格
    case 'ArrowUp':
      event.preventDefault();
      updateCell({ ...transformStart(-1, 0) });
      transformEnd(true);
      break;
    // 移动到当前活动单元格下面的单元格
    case 'ArrowDown':
      event.preventDefault();
      updateCell({ ...transformStart(1, 0) });
      transformEnd(true);
      break;
    // 移动到当前活动单元格左边的单元格
    case 'ArrowLeft':
      event.preventDefault();
      updateCell({ ...transformStart(0, -1) });
      transformEnd(false);
      break;
    // 移动到当前活动单元格右边的单元格
    case 'ArrowRight':
      event.preventDefault();
      updateCell({ ...transformStart(0, 1) });
      transformEnd(false);
      break;
    // Tab 移动到当前选中或活动单元格的右侧单元格，如果到最后一列且存在下一行，则从下一行开始移动
    // Tab + Shift 移动到当前选中或活动单元格的左侧单元格，如果到第一列且存在上一行，则从上一行开始移动
    case 'Tab':
      event.preventDefault();
      updateCell({
        ...transformStart(0, event.shiftKey ? -1 : 1),
        editable: false,
      });
      transformEnd(true);
      break;
    // 取消编辑并移动到当前活动单元格下面的单元格
    case 'Enter':
      event.preventDefault();
      updateCell({ ...transformStart(1, 0), editable: false });
      transformEnd(true);
      break;
    // 激活单元格编辑
    case 'F2':
      updateCell({ editable: true });
      transformEnd(false);
      break;
    // 取消单元格编辑
    case 'Escape':
      updateCell({ editable: false });
      transformEnd(false);
      break;
  }
};

const registerGlobalMousedownEvent = (event) => {
  const { flag } = getEventTargetNode(event, tableInstance.value.$el);
  activated.value = flag;
};

const changeInstance = (instance) => {
  if (instance) {
    instance.validate = validate;
  }
  vm.exposed = vm.exposeProxy = tableInstance.value = instance || {};
};

watch(activated, (value) => {
  !value && updateCell({ ...ORIGINAL_CELL_META });
});

watch(
  () => props.data,
  (data) => {
    cachedData.value = cloneDeep(data);
  },
  { immediate: true },
);

provide(
  PLUS_TABLE_INJECTION_KEY,
  reactive({
    tableKey: props.tableKey,
    rowKey: props.rowKey,
    tableWrapperInstance,
    tableInstance,
    paginationInstance,
    activated,
    cellMeta,
    cachedData,
    refColumns,
    cachedColumns,
    rowMeta,
    columnMeta,
    hasHidden,
  }),
);

const formRefs = shallowRef();
provide(PLUS_TABLE_FORM_INJECTION_KEY, formRefs);

onMounted(() => {
  document.addEventListener('keydown', registerGlobalKeydownEvent, false);
  window.addEventListener('mousedown', registerGlobalMousedownEvent, false);
});

onUnmounted(() => {
  document.removeEventListener('keydown', registerGlobalKeydownEvent, false);
  window.removeEventListener('mousedown', registerGlobalMousedownEvent, false);
});

onDeactivated(() => {
  document.removeEventListener('keydown', registerGlobalKeydownEvent, false);
  window.removeEventListener('mousedown', registerGlobalMousedownEvent, false);
});
</script>

<style lang="scss">
.re-table {
  .el-table {
    --el-table-header-bg-color: #f5f7fa;
    --el-table-header-text-color: #606266;
    --el-table-text-color: var(--el-text-color-regular);

    thead {
      th {
        font-weight: 500;
      }
    }
  }

  .current-cell {
    box-shadow: inset 0 0 0 1px var(--el-color-success-dark-2);
  }

  .dirty-cell {
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: -5px;
      left: -5px;
      border-width: 5px;
      border-style: solid;
      border-color: transparent var(--el-color-danger) transparent transparent;
      transform: rotate(45deg);
    }
  }

  .el-form-item {
    margin-bottom: 0;
  }
}
</style>
