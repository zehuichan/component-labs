import { useWatcher } from './watcher';
import { deleteRowField, writeRowField } from './write';
import { devWarn, getRowIdentity } from '../util';
import type { WritableComputedRef } from 'vue';
import type { TableHost } from './context';
import type { RowData } from '../table/defaults';
import type { CellPosition } from './current';
import type { AppliedHistoryChange } from './history';

function useStore<T extends RowData = RowData>(host: TableHost<T>) {
  const { core, ...watcher } = useWatcher<T>(host);
  let committedRowsByKey = new Map<string, T>();

  /**
   * 绑定当前 rowKey 配置的字段写入点；history / editing 的回滚都走这两个入口。
   * 行对象只在这里被就地修改，所以联动缓存的代数也统一在这里推进。
   */
  function writeField(row: T, prop: string, value: unknown) {
    const rowKey = watcher.getRowKey(row);
    const result = writeRowField(row, prop, value, {
      rowKey,
      rowKeyOption: watcher.states.rowKey.value,
    });
    if (result.wrote) watcher.bumpDependencyGeneration(rowKey);
    return result;
  }

  function deleteField(row: T, prop: string) {
    const rowKey = watcher.getRowKey(row);
    const result = deleteRowField(row, prop, {
      rowKey,
      rowKeyOption: watcher.states.rowKey.value,
    });
    if (result.wrote) watcher.bumpDependencyGeneration(rowKey);
    return result;
  }

  function setData(data: T[]) {
    const rowKey = watcher.states.rowKey.value;
    const nextRowsByKey = new Map<string, T>();
    for (const [rowIndex, row] of data.entries()) {
      const key = getRowIdentity(row, rowKey);
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
    }

    const invalidatedRowKeys: string[] = [];
    for (const [key, previousRow] of committedRowsByKey) {
      if (nextRowsByKey.get(key) === previousRow) continue;
      invalidatedRowKeys.push(key);
    }

    watcher.rowLifecycle.invalidate(invalidatedRowKeys);
    watcher.states.data.value = data;
    committedRowsByKey = nextRowsByKey;
    watcher.rowLifecycle.committed();
  }

  /**
   * 单元格写值流水线：写回行对象 → 历史 / 脏追踪 → cell-change → 联动 trigger → 按需校验。
   * 所有编辑路径（cell 提交 / row·table 直绑 / Delete 清空 / 联动 setValue / 自定义热键 setValue）统一走这里。
   */
  function setCellValue(row: T, rowIndex: number, prop: string, value: unknown) {
    // 同值写入提前退出，避免为一次空写建立脏基线快照；writeRowField 内部同样会兜底
    if (Object.is(row[prop], value)) return;
    const rowKey = watcher.getRowKey(row);
    // 必须在写值之前建基线，否则行的第一次编辑会把基线拍成修改后的值，永远测不出脏
    watcher.touchRow(row, rowKey);
    const { wrote, oldValue } = writeField(row, prop, value);
    if (!wrote) return;
    watcher.pushChange({ rowKey, prop, oldValue, newValue: value });
    watcher.markDirty(rowKey, prop);
    host.emit('cell-change', { row, rowIndex, prop, value, oldValue });
    watcher.notifyFieldChange(row, rowIndex, prop);
    if (watcher.states.validateEvent.value) {
      void watcher.validateCell(row, rowIndex, prop);
    }
  }

  core.commands.setCellValue = setCellValue;
  core.commands.writeRowField = writeField;
  core.commands.deleteRowField = deleteField;

  /** 撤销 / 重做：只回滚 row[prop] 并重新对比脏基线、emit('cell-change')、按需重新校验；
   * 不重新触发 dependencies.trigger，避免联动副作用在历史回放时被重复执行 */
  function applyHistoryChanges(applied: AppliedHistoryChange<T>[], direction: 'undo' | 'redo') {
    for (const change of applied) {
      watcher.markDirty(change.rowKey, change.prop);
      const value = direction === 'undo' ? change.oldValue : change.newValue;
      const oldValue = direction === 'undo' ? change.newValue : change.oldValue;
      host.emit('cell-change', {
        row: change.row,
        rowIndex: change.rowIndex,
        prop: change.prop,
        value,
        oldValue,
      });
      if (watcher.states.validateEvent.value) {
        void watcher.validateCell(change.row, change.rowIndex, change.prop);
      }
    }
  }

  function undo(): void {
    applyHistoryChanges(watcher.undo(), 'undo');
  }

  function redo(): void {
    applyHistoryChanges(watcher.redo(), 'redo');
  }

  function clearCell(rowIndex: number, colIndex: number) {
    const cell = watcher.locateCell(rowIndex, colIndex);
    if (!cell) return;
    setCellValue(cell.row, cell.rowIndex, cell.prop, null);
  }

  return {
    ...watcher,
    setData,
    setCellValue,
    writeRowField: writeField,
    deleteRowField: deleteField,
    clearCell,
    undo,
    redo,
  };
}

export default useStore;

export type InternalStore<T extends RowData = RowData> = ReturnType<typeof useStore<T>>;

/**
 * 公开 Store 成员白名单。新增内部成员默认不外泄，需在这里显式登记才对外可见，
 * 避免过去 Omit 黑名单那种「忘了加就意外公开」的脆弱性。
 */
type PublicStoreKey =
  | 'getRowKey'
  | 'locateCell'
  | 'setData'
  | 'setCellValue'
  | 'clearCell'
  /** 列 */
  | 'getColumnIndex'
  | 'settingItems'
  | 'toggleColumnVisible'
  | 'updateColumnOrder'
  | 'setColumnWidth'
  | 'resetSettings'
  /** 活动格与导航 */
  | 'isCurrentCell'
  | 'setCurrentCell'
  | 'moveCurrent'
  | 'moveSequential'
  | 'moveToRowEdge'
  | 'moveToTableCorner'
  | 'getCellEl'
  | 'scrollCellIntoView'
  | 'focusGrid'
  | 'focusCurrentCellEditor'
  /** 联动 */
  | 'getDependencyState'
  | 'notifyFieldChange'
  /** 撤销重做 */
  | 'canUndo'
  | 'canRedo'
  | 'pushChange'
  | 'undo'
  | 'redo'
  | 'clearHistory'
  /** 脏追踪 */
  | 'touchRow'
  | 'markDirty'
  | 'isCellDirty'
  | 'isRowDirty'
  | 'getDirtyCells'
  | 'getModifiedRows'
  | 'clearDirty'
  | 'resetTracking'
  /** 校验 */
  | 'getCellError'
  | 'getErrors'
  | 'validateCell'
  | 'validateRow'
  | 'validate'
  | 'clearValidate'
  | 'clearRowValidate'
  /** 编辑 */
  | 'canEditCell'
  | 'isCellEditing'
  | 'isRowEditing'
  | 'startEdit'
  | 'commitEdit'
  | 'cancelEdit'
  | 'startRowEdit'
  | 'setRowEditingCell'
  | 'clearRowEditingCell'
  | 'commitRowEdit'
  | 'cancelRowEdit'
  | 'getDraft'
  | 'setDraft'
  | 'flushDraft'
  | 'discardDraftsForRow'
  /** 行结构 */
  | 'insertRow'
  | 'removeRow'
  | 'moveRow'
  | 'duplicateRow';

type PublicStateKey =
  | 'data'
  | 'rowKey'
  | 'mode'
  | 'validateEvent'
  | 'history'
  | 'dirtyTracking'
  | 'keysMap'
  | 'rowKeyMap'
  | '_columns'
  | 'hiddenIds'
  | 'orderMap'
  | 'widthMap'
  | 'originColumns'
  | 'columns'
  | 'allColumns'
  | 'undoStack'
  | 'redoStack'
  | 'dirtyCells'
  | 'editingRowKey';

/** 对外维持原有 index-based Store 形态，稳定 CellRef 相关成员仅供组件内部使用。 */
export interface Store<T extends RowData = RowData> extends Pick<InternalStore<T>, PublicStoreKey> {
  states: Pick<InternalStore<T>['states'], PublicStateKey> & {
    currentCell: WritableComputedRef<CellPosition | null>;
    editingCell: WritableComputedRef<CellPosition | null>;
  };
}
