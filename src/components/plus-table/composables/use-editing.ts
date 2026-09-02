import { nextTick, reactive, shallowRef } from 'vue';
import { cloneDeep } from 'es-toolkit';
import { focusEditorElement, resolveEditable } from '../utils';
import { useCellRefSlot } from './use-cell-ref';
import type { PlusTableResolvedProps } from '../table';
import type { CellLocation, CellRef, RowData } from '../types';
import type { UseColumnsReturn } from './use-columns';
import type { UseCurrentReturn } from './use-current';
import type { UseDataReturn } from './use-data';
import type { UseDependenciesReturn } from './use-dependencies';
import type { UseDirtyReturn } from './use-dirty';
import type { UseHistoryReturn } from './use-history';
import type { UseValidationReturn } from './use-validation';
import type { WriteRowFieldResult } from './utils';

type UseEditingProps<T extends RowData> = Pick<UseDataReturn<T>, 'data' | 'keysMap' | 'getRowKey'> &
  Pick<UseColumnsReturn<T>, 'getColumnById' | 'getColumnIndex'> &
  Pick<UseDependenciesReturn<T>, 'getDependencyState'> &
  Pick<UseDirtyReturn<T>, 'markDirty'> &
  Pick<UseHistoryReturn<T>, 'withHistoryBatch' | 'getPushCount' | 'dropRecentRowChanges'> &
  Pick<UseValidationReturn<T>, 'validateRow' | 'clearRowValidate'> & {
    /** 活动格模块整体传入：既作 CellRef 解析器，也提供定位 / 聚焦能力 */
    current: UseCurrentReturn<T>;
    setCellValue: (row: T, rowIndex: number, prop: string, value: unknown) => void;
    writeRowField: (row: T, prop: string, value: unknown) => WriteRowFieldResult;
    deleteRowField: (row: T, prop: string) => WriteRowFieldResult;
  };

/**
 * 编辑状态机 + 统一草稿仓。cell / row / table 三种模式共用同一份按 rowKey、prop
 * 两级寻址的 `drafts`：cell 模式下只会有 editingCell 对应的这一个条目；row/table
 * 模式下文本类（失焦提交）编辑器各自按字段占一个条目。
 */
export function useEditing<T extends RowData = RowData>(
  props: PlusTableResolvedProps<T>,
  {
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
  }: UseEditingProps<T>,
) {
  const slot = useCellRefSlot(current);
  /** 对外按当前行列顺序呈现的编辑格下标位置。 */
  const editingCell = slot.position;
  /** row 模式：当前编辑行 key */
  const editingRowKey = shallowRef<string | null>(null);

  /** row 模式：当前编辑行快照，cancel 时回滚 */
  let editingRowSnapshot: T | null = null;
  /**
   * 行编辑会话纪元：会话开闭与会话内草稿的增删都会推进。
   * commitRowEdit 在 flush 之后记录它，await 校验期间只要发生任何新的编辑，
   * 提交就作废——比对纪元即可，无需为整行做深拷贝快照再深比较。
   */
  let editingSessionEpoch = 0;
  /** 行编辑会话开始时的历史入栈计数：取消编辑要连会话期间产生的历史一起撤掉 */
  let editingRowHistoryMark = 0;

  /** 统一草稿仓：cell 模式单槽、row/table 模式多槽，共用同一存储与结构化寻址方式 */
  const drafts = reactive(new Map<string, Map<string, unknown>>());

  function bumpSessionEpoch(): void {
    editingSessionEpoch += 1;
  }

  /** 只有落在当前编辑行上的改动才影响该会话 */
  function bumpSessionEpochFor(rowKey: string): void {
    if (editingRowKey.value === rowKey) bumpSessionEpoch();
  }

  function getEditingCellLocation(): CellLocation<T> | null {
    const ref = slot.get();
    return ref ? current.locateCellRef(ref) : null;
  }

  // ---- 草稿仓 ----

  function getDraft(rowKey: string, prop: string): { has: boolean; value: unknown } {
    const rowDrafts = drafts.get(rowKey);
    return { has: rowDrafts?.has(prop) ?? false, value: rowDrafts?.get(prop) };
  }

  function setDraft(rowKey: string, prop: string, value: unknown): void {
    let rowDrafts = drafts.get(rowKey);
    if (!rowDrafts) {
      rowDrafts = reactive(new Map<string, unknown>());
      drafts.set(rowKey, rowDrafts);
    }
    rowDrafts.set(prop, value);
    bumpSessionEpochFor(rowKey);
  }

  /**
   * 丢弃单格草稿。写入流水线在该字段落值后也会调用：草稿只是输入缓冲，任何经写契约
   * 生效的写入（联动 trigger、撤销重做、程序化 setCellValue）都让它作废，
   * 否则失焦时会用早已过期的缓冲覆盖掉新值。
   */
  function discardDraft(rowKey: string, prop: string): void {
    const rowDrafts = drafts.get(rowKey);
    if (!rowDrafts?.delete(prop)) return;
    bumpSessionEpochFor(rowKey);
    if (rowDrafts.size === 0) drafts.delete(rowKey);
  }

  function discardRefDraft(ref: CellRef): void {
    const prop = getColumnById(ref.colId)?.column.prop;
    if (prop !== undefined) discardDraft(ref.rowKey, prop);
  }

  /** 丢弃某行所有未提交的草稿（row 模式取消编辑 / 行被删除时调用，不写回） */
  function discardDraftsForRow(rowKey: string): void {
    if (drafts.delete(rowKey)) bumpSessionEpochFor(rowKey);
  }

  /** table 模式没有 editingRef；最后一个可见字段视图消失时仍需清掉其失焦草稿。 */
  function discardDraftProps(props: Iterable<string>): void {
    const rowKeys = [...keysMap.value.keys()];
    for (const prop of props) {
      for (const rowKey of rowKeys) discardDraft(rowKey, prop);
    }
  }

  /** 失焦提交：把缓冲的草稿经 setCellValue 流水线写回，随后清掉草稿位（row/table 模式文本类编辑器用） */
  function flushDraft(row: T, rowIndex: number, rowKey: string, prop: string): void {
    const draft = getDraft(rowKey, prop);
    if (!draft.has) return;
    discardDraft(rowKey, prop);
    setCellValue(row, rowIndex, prop, draft.value);
  }

  /** 一次行提交在用户眼里是一个动作，多字段写回并成一条历史，撤销一步回到提交前 */
  function flushRowDrafts(rowKey: string): void {
    bumpSessionEpochFor(rowKey);
    const found = keysMap.value.get(rowKey);
    if (!found) {
      discardDraftsForRow(rowKey);
      return;
    }
    const props = [...(drafts.get(rowKey)?.keys() ?? [])];
    if (props.length === 0) return;
    withHistoryBatch(() => {
      for (const prop of props) flushDraft(found.row, found.rowIndex, rowKey, prop);
    });
  }

  // ---- 可编辑性判定 ----

  function isLocatedCellEditable(cell: CellLocation<T>): boolean {
    return (
      props.mode !== 'none' &&
      resolveEditable(cell.row, cell.rowIndex, cell.node.column) &&
      !getDependencyState(cell.row, cell.rowIndex, cell.node).disabled
    );
  }

  function canEditCell(rowIndex: number, colIndex: number): boolean {
    const cell = current.locateCell(rowIndex, colIndex);
    return !!cell && isLocatedCellEditable(cell);
  }

  function isRowEditing(row: T): boolean {
    return editingRowKey.value === getRowKey(row);
  }

  function isEditingRef(rowKey: string, colId: string): boolean {
    return slot.has(rowKey, colId);
  }

  /** 单元格是否处于编辑器渲染态（三种模式统一入口） */
  function isCellEditing(rowIndex: number, colIndex: number): boolean {
    switch (props.mode) {
      case 'table':
        return canEditCell(rowIndex, colIndex);
      case 'row': {
        const row = data.value[rowIndex];
        return !!row && isRowEditing(row) && canEditCell(rowIndex, colIndex);
      }
      case 'cell': {
        const ref = current.toCellRef(rowIndex, colIndex);
        return !!ref && slot.has(ref.rowKey, ref.colId);
      }
      default:
        return false;
    }
  }

  async function focusEditor(ref: CellRef, hasInitialValue: boolean): Promise<void> {
    await nextTick();
    focusEditorElement(current.getCellElRef(ref), {
      select: hasInitialValue ? 'end' : 'all',
      skipIfFocused: true,
    });
  }

  // ---- 行 / 列失效清理 ----

  /** 隐藏活动编辑列时，按 allColumns 找回 prop 后丢弃草稿并退出该格编辑。 */
  function cleanEditingCell(): void {
    const ref = slot.get();
    if (!ref || getColumnIndex(ref.colId) >= 0) return;
    discardRefDraft(ref);
    slot.set(null);
  }

  /** 数据行身份失效时调用：丢弃该 rowKey 下全部编辑上下文，不把旧草稿写入新行。 */
  function invalidateEditingRow(rowKey: string): void {
    discardDraftsForRow(rowKey);
    if (slot.get()?.rowKey === rowKey) slot.set(null);
    if (editingRowKey.value === rowKey) endEditingRowSession();
  }

  // ---- cell 模式 ----

  /** cell 模式进编；defaultValue 用于可打印字符覆盖式进编 */
  function startEdit(
    rowIndex: number,
    colIndex: number,
    opts: { defaultValue?: unknown } = {},
  ): boolean {
    if (props.mode !== 'cell') return false;
    const ref = current.toCellRef(rowIndex, colIndex);
    const cell = ref && current.locateCellRef(ref);
    if (!ref || !cell || !isLocatedCellEditable(cell)) return false;
    if (slot.get()) commitEdit();
    const hasInitial = 'defaultValue' in opts;
    setDraft(cell.rowKey, cell.prop, hasInitial ? opts.defaultValue : cell.row[cell.prop]);
    slot.set(ref);
    current.setCurrentCell(rowIndex, colIndex);
    void focusEditor(ref, hasInitial);
    return true;
  }

  /** cell 模式提交：经 setCellValue 流水线（脏值跳过 / 联动 / 校验） */
  function commitEdit(): void {
    if (props.mode !== 'cell') return;
    const ref = slot.get();
    if (!ref) return;
    slot.set(null);
    const cell = current.locateCellRef(ref);
    if (!cell) {
      discardRefDraft(ref);
      return;
    }
    const draft = getDraft(cell.rowKey, cell.prop);
    if (!draft.has) return;
    discardDraft(cell.rowKey, cell.prop);
    setCellValue(cell.row, cell.rowIndex, cell.prop, draft.value);
  }

  function cancelEdit(): void {
    if (props.mode !== 'cell') return;
    const ref = slot.get();
    if (!ref) return;
    slot.set(null);
    discardRefDraft(ref);
  }

  // ---- row 模式 ----

  function endEditingRowSession(): void {
    editingRowKey.value = null;
    editingRowSnapshot = null;
    bumpSessionEpoch();
  }

  function clearEditingRow(flush: boolean): void {
    const rowKey = editingRowKey.value;
    if (!rowKey) return;
    if (flush) flushRowDrafts(rowKey);
    else discardDraftsForRow(rowKey);
    if (slot.get()?.rowKey === rowKey) slot.set(null);
    endEditingRowSession();
  }

  function clearRowEditingCell(flush = false): void {
    const ref = slot.get();
    if (!ref || props.mode !== 'row') return;
    const cell = current.locateCellRef(ref);
    if (flush && cell) flushDraft(cell.row, cell.rowIndex, cell.rowKey, cell.prop);
    slot.set(null);
    discardRefDraft(ref);
  }

  /** row 模式：在已进编的行上设置当前格编辑器 */
  function setRowEditingCell(rowIndex: number, colIndex: number): boolean {
    if (props.mode !== 'row') return false;
    const ref = current.toCellRef(rowIndex, colIndex);
    const cell = ref && current.locateCellRef(ref);
    if (!ref || !cell || !isRowEditing(cell.row) || !isLocatedCellEditable(cell)) return false;
    clearRowEditingCell(true);
    setDraft(cell.rowKey, cell.prop, cell.row[cell.prop]);
    slot.set(ref);
    current.setCurrentCell(rowIndex, colIndex, false);
    void focusEditor(ref, false);
    return true;
  }

  function startRowEdit(rowIndex: number): boolean {
    if (props.mode !== 'row') return false;
    const row = data.value[rowIndex];
    if (!row) return false;
    const key = getRowKey(row);
    if (editingRowKey.value === key) return true;
    clearEditingRow(true);
    // 上一行的提交历史已经入栈，标记要在其之后取，取消本行只回滚本会话
    editingRowHistoryMark = getPushCount();
    editingRowSnapshot = cloneDeep(row);
    editingRowKey.value = key;
    bumpSessionEpoch();
    return true;
  }

  /** row 模式提交：整行校验通过才退出编辑态 */
  async function commitRowEdit(rowIndex: number): Promise<boolean> {
    const row = data.value[rowIndex];
    if (!row) return false;
    const key = getRowKey(row);
    if (editingRowKey.value !== key) return false;
    flushRowDrafts(key);
    slot.set(null);
    // 本次提交自身的写入已全部落地，此后纪元再变说明校验期间又发生了编辑
    const epoch = editingSessionEpoch;
    const errors = await validateRow(rowIndex);
    if (errors.length) return false;
    if (
      editingSessionEpoch !== epoch ||
      editingRowKey.value !== key ||
      keysMap.value.get(key)?.row !== row
    ) {
      return false;
    }
    endEditingRowSession();
    return true;
  }

  /** row 模式取消：静默回滚到快照（不触发联动与 cell-change） */
  function cancelRowEdit(rowIndex: number): void {
    const row = data.value[rowIndex];
    if (!row) return;
    const key = getRowKey(row);
    if (editingRowKey.value !== key) return;
    slot.set(null);
    // 未提交的草稿本来就没写进 row，直接丢弃即可；不能 flush，否则等于强行提交取消中的编辑
    discardDraftsForRow(key);
    // 取消是历史边界：会话期间已入栈的变更必须一并丢掉，否则 redo 能把取消掉的编辑复活
    dropRecentRowChanges(key, getPushCount() - editingRowHistoryMark);
    const touchedProps = new Set(Object.keys(row));
    const snapshot = editingRowSnapshot;
    if (snapshot) {
      for (const prop of Object.keys(snapshot)) touchedProps.add(prop);
      // 逐字段经写契约回滚，快照里没有的键按同样的 rowKey 保护删除
      for (const prop of Object.keys(row)) {
        if (!(prop in snapshot)) deleteRowField(row, prop);
      }
      for (const [prop, value] of Object.entries(cloneDeep(snapshot))) {
        writeRowField(row, prop, value);
      }
    }
    for (const prop of touchedProps) markDirty(key, prop);
    endEditingRowSession();
    clearRowValidate(row);
  }

  return {
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
  };
}

export type UseEditingReturn<T extends RowData = RowData> = ReturnType<typeof useEditing<T>>;
