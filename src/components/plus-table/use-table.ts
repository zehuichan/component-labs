import { watch, watchEffect } from 'vue';
import {
  useColumns,
  useCurrent,
  useData,
  useDependencies,
  useDirty,
  useEditing,
  useHistory,
  useRows,
  useValidation,
} from './composables';
import { deleteRowField as deleteField, writeRowField as writeField } from './composables/utils';
import { TABLE_MODE_EDITOR_LIMIT } from './constants';
import { devWarn, getRowIdentity } from './utils';
import type { AppliedHistoryChange } from './composables/use-history';
import type { PlusTableResolvedProps, TableHost } from './table';
import type { RowData } from './types';

/**
 * 装配层：按依赖顺序调用各 composable，显式解构、显式传参、显式返回。
 * 写命令（setCellValue / writeRowField / deleteRowField）以函数声明提供，
 * 靠提升即可在装配期传给下游；它们只在运行期被调用。
 */
export function useTable<T extends RowData = RowData>(
  props: PlusTableResolvedProps<T>,
  host: TableHost<T>,
) {
  const { emit, gridRef, ids, hasDataListener } = host;

  const { data, keysMap, rowKeyMap, getRowKey, readDataSnapshot } = useData<T>(props);

  const {
    columnTree,
    hiddenIds,
    orderMap,
    widthMap,
    originColumns,
    columns,
    allColumns,
    triggerIndex,
    visibleColumnsById,
    validationSchema,
    settingItems,
    getColumnById,
    getColumnsByProp,
    getColumnIndex,
    toggleColumnVisible,
    updateColumnOrder,
    setColumnWidth,
    clearColumnWidth,
    resetSettings,
  } = useColumns<T>(props);

  const current = useCurrent<T>({
    data,
    keysMap,
    getRowKey,
    columns,
    getColumnIndex,
    gridRef,
    ids,
  });
  const {
    currentCell,
    toCellRef,
    resolveCellPosition,
    locateCellRef,
    locateCell,
    getCurrentRef,
    getCurrentCellLocation,
    getCellElRef,
    getCellEl,
    scrollCellRef,
    scrollCellIntoView,
    setCurrentCell,
    isCurrentRef,
    isCurrentCell,
    invalidateCurrentRow,
    cleanCurrent,
    moveCurrent,
    moveSequential,
    moveToRowEdge,
    moveToTableCorner,
    focusGrid,
    focusCurrentCellEditor,
  } = current;

  const {
    getDependencyState,
    notifyFieldChange,
    bumpDependencyGeneration,
    invalidateDependencyRow,
    clearDependencyCache,
  } = useDependencies<T>({ keysMap, getRowKey, triggerIndex, setCellValue });

  const {
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    pushChange,
    withHistoryBatch,
    getPushCount,
    dropRecentRowChanges,
    popUndo,
    popRedo,
    clearHistory,
    invalidateHistoryRow,
  } = useHistory<T>(props, { keysMap, writeRowField });

  const {
    dirtyCells,
    touchRow,
    markDirty,
    isCellDirty,
    isRowDirty,
    getDirtyCells,
    getModifiedRows,
    clearDirty,
    resetTracking,
    invalidateDirtyRow,
  } = useDirty<T>(props, { data, keysMap, getRowKey });

  const {
    getCellError,
    getErrors,
    validateCell,
    validateRow,
    validate,
    clearValidate,
    clearRowValidate,
    invalidateValidationRow,
    invalidateColumnProps,
    reindexValidationErrors,
  } = useValidation<T>({
    data,
    keysMap,
    getRowKey,
    columns,
    allColumns,
    getColumnsByProp,
    getDependencyState,
    setCurrentCell,
  });

  const {
    editingCell,
    editingRowKey,
    canEditCell,
    isCellEditing,
    isEditingRef,
    isRowEditing,
    getEditingCellLocation,
    cleanEditingCell,
    discardDraftProps,
    startEdit,
    commitEdit,
    cancelEdit,
    startRowEdit,
    setRowEditingCell,
    clearRowEditingCell,
    commitRowEdit,
    cancelRowEdit,
    getDraft,
    setDraft,
    flushDraft,
    discardDraft,
    discardDraftsForRow,
    invalidateEditingRow,
  } = useEditing<T>(props, {
    data,
    keysMap,
    getRowKey,
    getColumnById,
    getColumnIndex,
    current,
    getDependencyState,
    markDirty,
    withHistoryBatch,
    getPushCount,
    dropRecentRowChanges,
    validateRow,
    clearRowValidate,
    setCellValue,
    writeRowField,
    deleteRowField,
  });

  const { insertRow, removeRow, moveRow, duplicateRow } = useRows<T>(props, {
    data,
    keysMap,
    emit,
    hasDataListener,
  });

  // ---- 写契约 ----

  /**
   * 绑定当前 rowKey 配置的字段写入点；history / editing 的回滚都走这两个入口。
   * 行对象只在这里被就地修改，所以联动缓存的代数也统一在这里推进。
   */
  function writeRowField(row: T, prop: string, value: unknown) {
    const key = getRowKey(row);
    const result = writeField(row, prop, value, { rowKey: key, rowKeyOption: props.rowKey });
    if (result.wrote) bumpDependencyGeneration(key);
    return result;
  }

  function deleteRowField(row: T, prop: string) {
    const key = getRowKey(row);
    const result = deleteField(row, prop, { rowKey: key, rowKeyOption: props.rowKey });
    if (result.wrote) bumpDependencyGeneration(key);
    return result;
  }

  function scheduleValidate(row: T, rowIndex: number, prop: string): void {
    if (!props.validateEvent) return;
    void validateCell(row, rowIndex, prop).catch((error) => {
      console.error('[PlusTable] validateCell 失败：', error);
    });
  }

  /**
   * 单元格写值流水线：写回行对象 → 历史 / 脏追踪 → cell-change → 联动 trigger → 按需校验。
   * 所有编辑路径（cell 提交 / row·table 直绑 / Delete 清空 / 联动 setValue / 自定义热键 setValue）统一走这里。
   * 公开事件与联动一律用 keysMap 解析出的最新下标；调用方传入的 rowIndex 只作提示，不再原样透传。
   */
  function setCellValue(row: T, _rowIndex: number, prop: string, value: unknown): void {
    // 同值写入提前退出，避免为一次空写建立脏基线快照；writeRowField 内部同样会兜底
    if (Object.is(row[prop], value)) return;
    const key = getRowKey(row);
    const location = keysMap.value.get(key);
    // 行已不在当前数据里（换页 / remove 后仍持有旧闭包）：静默丢弃，不写也不 emit
    if (location?.row !== row) return;
    const { rowIndex } = location;
    // 必须在写值之前建基线，否则行的第一次编辑会把基线拍成修改后的值，永远测不出脏
    touchRow(row, key);
    const { wrote, oldValue } = writeRowField(row, prop, value);
    if (!wrote) return;
    // 写契约是唯一真相：任何经流水线落地的值都让同字段草稿作废，避免失焦把旧缓冲盖回来
    discardDraft(key, prop);
    // 主写入与联动级联并成一个原子撤销单元：用户看到的是一次编辑
    withHistoryBatch(() => {
      pushChange({ rowKey: key, prop, oldValue, newValue: value });
      markDirty(key, prop);
      emit('cell-change', { row, rowIndex, prop, value, oldValue });
      notifyFieldChange(row, rowIndex, prop);
    });
    scheduleValidate(row, rowIndex, prop);
  }

  function clearCell(rowIndex: number, colIndex: number): void {
    const cell = locateCell(rowIndex, colIndex);
    if (cell) setCellValue(cell.row, cell.rowIndex, cell.prop, null);
  }

  /** 撤销 / 重做：只回滚 row[prop] 并重新对比脏基线、emit('cell-change')、按需重新校验；
   * 不重新触发 dependencies.trigger，避免联动副作用在历史回放时被重复执行 */
  function applyHistoryChanges(applied: AppliedHistoryChange<T>[], direction: 'undo' | 'redo') {
    for (const change of applied) {
      const { row, rowIndex, prop } = change;
      const [value, oldValue] =
        direction === 'undo'
          ? [change.oldValue, change.newValue]
          : [change.newValue, change.oldValue];
      discardDraft(change.rowKey, prop);
      markDirty(change.rowKey, prop);
      emit('cell-change', { row, rowIndex, prop, value, oldValue });
      scheduleValidate(row, rowIndex, prop);
    }
  }

  function undo(): void {
    applyHistoryChanges(popUndo(), 'undo');
  }

  function redo(): void {
    applyHistoryChanges(popRedo(), 'redo');
  }

  // ---- 行生命周期 ----

  const rowInvalidators = [
    invalidateCurrentRow,
    invalidateEditingRow,
    invalidateHistoryRow,
    invalidateDirtyRow,
    invalidateValidationRow,
    invalidateDependencyRow,
  ];
  let committedRowsByKey = new Map<string, T>();

  /** 同 rowKey 换了行对象即视为身份失效，所有按 rowKey 寻址的域一并清理；纯重排只重算下标。 */
  function setData(next: T[]): void {
    const option = props.rowKey;
    const nextRowsByKey = new Map<string, T>();
    next.forEach((row, rowIndex) => {
      const key = getRowIdentity(row, option);
      if (nextRowsByKey.has(key)) {
        throw new Error(
          `[PlusTable] setData 失败：第 ${rowIndex} 行的 rowKey="${key}" 与前序行重复。`,
        );
      }
      if (Object.isFrozen(row)) {
        devWarn(
          `[PlusTable] 第 ${rowIndex} 行（rowKey="${key}"）是冻结对象：字段编辑就地修改行对象，冻结行无法写入。`,
        );
      }
      nextRowsByKey.set(key, row);
    });

    for (const [key, previousRow] of committedRowsByKey) {
      if (nextRowsByKey.get(key) === previousRow) continue;
      for (const invalidate of rowInvalidators) invalidate(key);
    }
    data.value = next;
    committedRowsByKey = nextRowsByKey;
    reindexValidationErrors();
  }

  // ---- 列变化联动 ----

  watch(
    visibleColumnsById,
    (next, previous) => {
      const nextProps = new Set(
        [...next.values()].map((node) => node.column.prop).filter((prop): prop is string => !!prop),
      );
      const removedProps = new Set<string>();
      for (const [id, node] of previous) {
        const prop = node.column.prop;
        if (prop && next.get(id)?.column.prop !== prop && !nextProps.has(prop)) {
          removedProps.add(prop);
        }
      }
      discardDraftProps(removedProps);
      cleanCurrent();
      cleanEditingCell();
    },
    { flush: 'sync' },
  );

  // 列配置重建（含就地改写联动回调）后，缓存里按 colId 存的旧联动结果一律作废
  watch(allColumns, clearDependencyCache, { flush: 'sync' });

  watch(
    validationSchema,
    (next, previous) => {
      const changedProps = new Set(
        [...previous, ...next]
          .map((column) => column.prop)
          .filter((prop): prop is string => !!prop),
      );
      invalidateColumnProps(changedProps);
    },
    { deep: true, flush: 'sync' },
  );

  /** 规模只提醒一次；告警后 effect 不再读任何响应式源，等价于自动停表。 */
  let editorScaleWarned = false;
  watchEffect(
    () => {
      if (editorScaleWarned || props.mode !== 'table') return;
      const editableColumnCount = columns.value.filter(
        (node) => node.column.prop && node.column.editable,
      ).length;
      const rowCount = data.value.length;
      const editorCount = rowCount * editableColumnCount;
      if (editorCount <= TABLE_MODE_EDITOR_LIMIT) return;
      editorScaleWarned = true;
      devWarn(
        `[PlusTable] mode="table" 需常驻渲染约 ${editorCount} 个编辑器（${rowCount} 行 × ${editableColumnCount} 可编辑列），` +
          `已超过建议上限 ${TABLE_MODE_EDITOR_LIMIT}：请改用分页或切到 cell / row 模式。`,
      );
    },
    { flush: 'sync' },
  );

  // ---- 跟随 props 同步 ----

  setData(readDataSnapshot());
  // 取值函数抛错时 Vue 不会调用回调（或在配置了 errorHandler 时以 undefined 调用），这里兜一下
  watch(readDataSnapshot, (snapshot) => {
    if (snapshot) setData(snapshot);
  });
  watch(
    () => props.history,
    (enabled) => {
      if (!enabled) clearHistory();
    },
  );

  return {
    // data
    data,
    keysMap,
    rowKeyMap,
    getRowKey,
    setData,

    // write pipeline
    setCellValue,
    writeRowField,
    deleteRowField,
    clearCell,
    undo,
    redo,

    // columns
    columnTree,
    hiddenIds,
    orderMap,
    widthMap,
    originColumns,
    columns,
    allColumns,
    triggerIndex,
    visibleColumnsById,
    validationSchema,
    settingItems,
    getColumnById,
    getColumnsByProp,
    getColumnIndex,
    toggleColumnVisible,
    updateColumnOrder,
    setColumnWidth,
    clearColumnWidth,
    resetSettings,

    // current
    currentCell,
    toCellRef,
    resolveCellPosition,
    locateCellRef,
    locateCell,
    getCurrentRef,
    getCurrentCellLocation,
    getCellElRef,
    getCellEl,
    scrollCellRef,
    scrollCellIntoView,
    setCurrentCell,
    isCurrentRef,
    isCurrentCell,
    invalidateCurrentRow,
    cleanCurrent,
    moveCurrent,
    moveSequential,
    moveToRowEdge,
    moveToTableCorner,
    focusGrid,
    focusCurrentCellEditor,

    // dependencies
    getDependencyState,
    notifyFieldChange,
    bumpDependencyGeneration,
    invalidateDependencyRow,
    clearDependencyCache,

    // history
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    pushChange,
    withHistoryBatch,
    getPushCount,
    dropRecentRowChanges,
    popUndo,
    popRedo,
    clearHistory,
    invalidateHistoryRow,

    // dirty
    dirtyCells,
    touchRow,
    markDirty,
    isCellDirty,
    isRowDirty,
    getDirtyCells,
    getModifiedRows,
    clearDirty,
    resetTracking,
    invalidateDirtyRow,

    // validation
    getCellError,
    getErrors,
    validateCell,
    validateRow,
    validate,
    clearValidate,
    clearRowValidate,
    invalidateValidationRow,
    invalidateColumnProps,
    reindexValidationErrors,

    // editing
    editingCell,
    editingRowKey,
    canEditCell,
    isCellEditing,
    isEditingRef,
    isRowEditing,
    getEditingCellLocation,
    cleanEditingCell,
    discardDraftProps,
    startEdit,
    commitEdit,
    cancelEdit,
    startRowEdit,
    setRowEditingCell,
    clearRowEditingCell,
    commitRowEdit,
    cancelRowEdit,
    getDraft,
    setDraft,
    flushDraft,
    discardDraft,
    discardDraftsForRow,
    invalidateEditingRow,

    // rows
    insertRow,
    removeRow,
    moveRow,
    duplicateRow,
  };
}

export type UseTableReturn<T extends RowData = RowData> = ReturnType<typeof useTable<T>>;
