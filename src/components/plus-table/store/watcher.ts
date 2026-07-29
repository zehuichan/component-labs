import { computed, watch, watchEffect } from 'vue';
import { assertRowKey, devWarn, getRowIdentity } from '../util';
import { createCoreStates, requireCommand } from './context';
import { useColumns } from './columns';
import { useCurrent, type CellRef } from './current';
import { useDependencies } from './dependencies';
import { useDirty } from './dirty';
import { useEditing } from './editing';
import { useHistory } from './history';
import { useRows } from './rows';
import { useValidation } from './validation';
import type {
  CellLocation,
  DeleteRowFieldCommand,
  RowLocation,
  SetCellValueCommand,
  TableCoreContext,
  TableCoreStates,
  TableHost,
  WriteRowFieldCommand,
} from './context';
import type { RowData } from '../table/defaults';

export type { CellLocation, RowLocation } from './context';

/** table 模式给每个可编辑格常驻一个编辑器实例，超过这个量级基本必然卡顿。 */
const TABLE_MODE_EDITOR_LIMIT = 2000;

/**
 * 装配期自检：子 store 是扁平合并成一个 store 的，同名成员只会剩下最后一个，
 * TypeScript 对展开里的重名不报错，漏掉就是运行期静默失效。开发期直接拦住。
 */
function assertDisjointKeys(scope: string, parts: readonly object[]): void {
  if (!(import.meta as any)?.env?.DEV) return;
  const owners = new Map<string, number>();
  parts.forEach((part, index) => {
    for (const key of Object.keys(part)) {
      // 每个子 store 都带自己的 states，合并后由外层显式重建，不算冲突
      if (key === 'states') continue;
      const owner = owners.get(key);
      if (owner !== undefined) {
        throw new Error(
          `[PlusTable] 内部错误：${scope} 第 ${owner} 与第 ${index} 个来源都定义了 "${key}"，扁平合并会静默覆盖其中之一。`,
        );
      }
      owners.set(key, index);
    }
  });
}

/**
 * 装配层：先建共享原语（core），再按依赖顺序注入各子 store。
 * 子 store 之间只通过显式参数互访，不再回读 table.store，装配期不存在环。
 */
export function useWatcher<T extends RowData = RowData>(host: TableHost<T>) {
  const baseStates = createCoreStates(host);

  const rowRegistry = computed(() => {
    const keysMap = new Map<string, RowLocation<T>>();
    const rowKeyMap = new WeakMap<T, string>();
    const rowKey = baseStates.rowKey.value;
    assertRowKey(rowKey);

    baseStates.data.value.forEach((row: T, rowIndex: number) => {
      const key = getRowIdentity(row, rowKey);
      const existing = keysMap.get(key);
      if (existing) {
        throw new Error(
          `[PlusTable] rowKey="${key}" 重复：第 ${existing.rowIndex} 行与第 ${rowIndex} 行使用了相同标识。`,
        );
      }
      keysMap.set(key, { row, rowIndex });
      rowKeyMap.set(row, key);
    });

    return { keysMap, rowKeyMap };
  });

  const states: TableCoreStates<T> = {
    ...baseStates,
    keysMap: computed(() => rowRegistry.value.keysMap),
    rowKeyMap: computed(() => rowRegistry.value.rowKeyMap),
  };

  function getRowKey(row: T): string {
    return states.rowKeyMap.value.get(row) ?? getRowIdentity(row, states.rowKey.value);
  }

  const core: TableCoreContext<T> = {
    host,
    states,
    getRowKey,
    commands: {
      setCellValue: null,
      writeRowField: null,
      deleteRowField: null,
    },
  };

  /** 写命令由 store/index.ts 在 mutations 就绪后回填，这里只做延迟转发。 */
  const setCellValue: SetCellValueCommand<T> = (row, rowIndex, prop, value) =>
    requireCommand(core.commands.setCellValue, 'setCellValue')(row, rowIndex, prop, value);
  const writeRowField: WriteRowFieldCommand<T> = (row, prop, value) =>
    requireCommand(core.commands.writeRowField, 'writeRowField')(row, prop, value);
  const deleteRowField: DeleteRowFieldCommand<T> = (row, prop) =>
    requireCommand(core.commands.deleteRowField, 'deleteRowField')(row, prop);

  const columns = useColumns(core);
  const current = useCurrent(core, {
    columns: columns.states.columns,
    getColumnIndex: columns.getColumnIndex,
  });

  /** 按最新行列顺序把稳定身份解析为完整单元格上下文。 */
  function locateCellRef(ref: CellRef): CellLocation<T> | null {
    const position = current.resolveCellPosition(ref);
    if (!position) return null;
    const { rowIndex, colIndex } = position;
    const row = states.data.value[rowIndex];
    const node = columns.states.columns.value[colIndex];
    const prop = node?.column.prop;
    if (!row || !node || !prop) return null;
    return { row, rowIndex, node, colIndex, prop, rowKey: ref.rowKey };
  }

  function locateCell(rowIndex: number, colIndex: number): CellLocation<T> | null {
    const ref = current.toCellRef(rowIndex, colIndex);
    return ref ? locateCellRef(ref) : null;
  }

  function getCurrentCellLocation(): CellLocation<T> | null {
    const ref = current.getCurrentRef();
    return ref ? locateCellRef(ref) : null;
  }

  const dependencies = useDependencies(core, {
    triggerIndex: columns.states.triggerIndex,
    setCellValue,
  });
  const history = useHistory(core, { writeRowField });
  const dirty = useDirty(core);
  const validation = useValidation(core, {
    allColumns: columns.states.allColumns,
    columns: columns.states.columns,
    getColumnsByProp: columns.getColumnsByProp,
    getDependencyState: dependencies.getDependencyState,
    setCurrentCell: current.setCurrentCell,
  });
  const editing = useEditing(core, {
    resolveCellPosition: current.resolveCellPosition,
    toCellRef: current.toCellRef,
    locateCell,
    locateCellRef,
    getCellElRef: current.getCellElRef,
    setCurrentCell: current.setCurrentCell,
    getColumnById: columns.getColumnById,
    getColumnIndex: columns.getColumnIndex,
    getDependencyState: dependencies.getDependencyState,
    validateRow: validation.validateRow,
    clearRowValidate: validation.clearRowValidate,
    markDirty: dirty.markDirty,
    historyPushCount: history.getPushCount,
    dropRecentRowChanges: history.dropRecentRowChanges,
    withHistoryBatch: history.withHistoryBatch,
    setCellValue,
    writeRowField,
    deleteRowField,
  });
  const rows = useRows(core);

  const rowInvalidators = [
    current.invalidateCurrentRow,
    editing.invalidateEditingRow,
    history.invalidateHistoryRow,
    dirty.invalidateDirtyRow,
    validation.invalidateValidationRow,
    dependencies.invalidateDependencyRow,
  ] as const;
  const rowLifecycle = {
    invalidate(rowKeys: Iterable<string>): void {
      for (const rowKey of rowKeys) {
        for (const invalidate of rowInvalidators) invalidate(rowKey);
      }
    },
    committed(): void {
      validation.reindexValidationErrors();
    },
  };

  watch(
    columns.states.visibleColumnsById,
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
      editing.discardDraftProps(removedProps);
      current.cleanCurrent();
      editing.cleanEditingCell();
    },
    { flush: 'sync' },
  );

  // 列配置重建（含就地改写联动回调）后，缓存里按 colId 存的旧联动结果一律作废
  watch(columns.states.allColumns, dependencies.clearDependencyCache, { flush: 'sync' });

  /** 规模只提醒一次；告警后 effect 不再读任何响应式源，等价于自动停表。 */
  let editorScaleWarned = false;
  watchEffect(
    () => {
      if (editorScaleWarned || states.mode.value !== 'table') return;
      const editableColumnCount = columns.states.columns.value.filter(
        (node) => node.column.prop && node.column.editable,
      ).length;
      const rowCount = states.data.value.length;
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

  watch(
    columns.states.validationSchema,
    (next, previous) => {
      const changedProps = new Set(
        [...previous, ...next]
          .map((column) => column.prop)
          .filter((prop): prop is string => !!prop),
      );
      validation.invalidateColumnProps(changedProps);
    },
    { deep: true, flush: 'sync' },
  );

  const own = {
    core,
    getRowKey,
    locateCell,
    locateCellRef,
    getCurrentCellLocation,
    rowLifecycle,
  };

  assertDisjointKeys('store 成员', [
    own,
    columns,
    current,
    dependencies,
    history,
    dirty,
    validation,
    editing,
    rows,
  ]);
  assertDisjointKeys('store.states', [
    states,
    columns.states,
    current.states,
    history.states,
    dirty.states,
    editing.states,
  ]);

  return {
    ...own,
    ...columns,
    ...current,
    ...dependencies,
    ...history,
    ...dirty,
    ...validation,
    ...editing,
    ...rows,
    states: {
      ...states,
      ...columns.states,
      ...current.states,
      ...history.states,
      ...dirty.states,
      ...editing.states,
    },
  };
}
