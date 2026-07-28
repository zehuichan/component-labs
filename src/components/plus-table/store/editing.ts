import { computed, nextTick, reactive, shallowRef } from 'vue';
import { cloneDeep, isEqual } from 'es-toolkit';
import { focusEditorElement, resolveEditable } from '../util';
import { cellRefKey, type CellPosition, type CellRef } from './current';
import type {
  CellLocation,
  DeleteRowFieldCommand,
  SetCellValueCommand,
  TableCoreContext,
  WriteRowFieldCommand,
} from './context';
import type { DependencyState } from './dependencies';
import type { CellError, RowData } from '../table/defaults';
import type { ColumnNode } from '../table-column/defaults';

export interface EditingDeps<T extends RowData = RowData> {
  resolveCellPosition: (ref: CellRef) => CellPosition | null;
  toCellRef: (rowIndex: number, colIndex: number) => CellRef | null;
  locateCell: (rowIndex: number, colIndex: number) => CellLocation<T> | null;
  locateCellRef: (ref: CellRef) => CellLocation<T> | null;
  getCellElRef: (ref: CellRef) => HTMLElement | null;
  setCurrentCell: (rowIndex: number, colIndex: number, scroll?: boolean) => void;
  getColumnById: (id: string) => ColumnNode<T> | null;
  getColumnIndex: (columnKey: string) => number;
  getDependencyState: (row: T, rowIndex: number, node: ColumnNode<T>) => DependencyState;
  validateRow: (rowIndex: number) => Promise<CellError[]>;
  clearRowValidate: (row: T) => void;
  markDirty: (rowKey: string, prop: string) => void;
  setCellValue: SetCellValueCommand<T>;
  writeRowField: WriteRowFieldCommand<T>;
  deleteRowField: DeleteRowFieldCommand<T>;
}

/**
 * 编辑状态机 + 统一草稿仓。cell / row / table 三种模式共用同一份按 rowKey、prop
 * 两级寻址的 `drafts`：cell 模式下只会有 editingCell 对应的这一个条目；row/table
 * 模式下文本类（失焦提交）编辑器各自按字段占一个条目。
 */
export function useEditing<T extends RowData = RowData>(
  core: TableCoreContext<T>,
  deps: EditingDeps<T>,
) {
  const coreStates = core.states;
  const editingRef = shallowRef<CellRef | null>(null);
  const states = {
    /** 兼容公开 Store：对外仍按当前行列顺序呈现下标位置。 */
    editingCell: computed<CellPosition | null>({
      get: (previous) => {
        const current = editingRef.value;
        const next = current ? deps.resolveCellPosition(current) : null;
        return isEqual(previous, next) ? (previous ?? null) : next;
      },
      set: (next) => {
        setEditingCell(next ? deps.toCellRef(next.rowIndex, next.colIndex) : null);
      },
    }),
    /** row 模式：当前编辑行 key */
    editingRowKey: shallowRef<string | null>(null),
  };
  /** cell 模式按 key 订阅编辑态，只让旧格和新格的渲染失效。 */
  const editingCells = reactive(new Set<string>());

  /** row 模式：当前编辑行快照，cancel 时回滚 */
  let editingRowSnapshot: T | null = null;
  /**
   * 行编辑会话纪元：会话开闭与会话内草稿的增删都会推进。
   * commitRowEdit 在 flush 之后记录它，await 校验期间只要发生任何新的编辑，
   * 提交就作废——比对纪元即可，无需为整行做深拷贝快照再深比较。
   */
  let editingSessionEpoch = 0;

  /** 统一草稿仓：cell 模式单槽、row/table 模式多槽，共用同一存储与结构化寻址方式 */
  const drafts = reactive(new Map<string, Map<string, unknown>>());

  function bumpSessionEpoch(): void {
    editingSessionEpoch += 1;
  }

  /** 只有落在当前编辑行上的改动才影响该会话 */
  function bumpSessionEpochFor(rowKey: string): void {
    if (states.editingRowKey.value === rowKey) bumpSessionEpoch();
  }

  function setEditingCell(next: CellRef | null): void {
    const current = editingRef.value;
    if (
      current === next ||
      (current && next && current.rowKey === next.rowKey && current.colId === next.colId)
    ) {
      return;
    }
    if (current) editingCells.delete(cellRefKey(current.rowKey, current.colId));
    editingRef.value = next;
    if (next) editingCells.add(cellRefKey(next.rowKey, next.colId));
  }

  function getEditingCellLocation(): CellLocation<T> | null {
    const ref = editingRef.value;
    return ref ? deps.locateCellRef(ref) : null;
  }

  function getDraft(rowKey: string, prop: string): { has: boolean; value: unknown } {
    const rowDrafts = drafts.get(rowKey);
    return {
      has: rowDrafts?.has(prop) ?? false,
      value: rowDrafts?.get(prop),
    };
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

  function deleteDraft(rowKey: string, prop: string): void {
    const rowDrafts = drafts.get(rowKey);
    if (!rowDrafts?.delete(prop)) return;
    bumpSessionEpochFor(rowKey);
    if (rowDrafts.size === 0) drafts.delete(rowKey);
  }

  function getRefProp(ref: CellRef): string | undefined {
    return deps.getColumnById(ref.colId)?.column.prop;
  }

  function deleteRefDraft(ref: CellRef): void {
    const prop = getRefProp(ref);
    if (prop !== undefined) deleteDraft(ref.rowKey, prop);
  }

  /** 隐藏活动编辑列时，按 allColumns 找回 prop 后丢弃草稿并退出该格编辑。 */
  function cleanEditingCell(): void {
    const current = editingRef.value;
    if (!current || deps.getColumnIndex(current.colId) >= 0) return;
    deleteRefDraft(current);
    setEditingCell(null);
  }

  /** table 模式没有 editingRef；最后一个可见字段视图消失时仍需清掉其失焦草稿。 */
  function discardDraftProps(props: Iterable<string>): void {
    const rowKeys = [...coreStates.keysMap.value.keys()];
    for (const prop of props) {
      for (const rowKey of rowKeys) deleteDraft(rowKey, prop);
    }
  }

  /** 失焦提交：把缓冲的草稿经 setCellValue 流水线写回，随后清掉草稿位（row/table 模式文本类编辑器用） */
  function flushDraft(row: T, rowIndex: number, rowKey: string, prop: string): void {
    const draft = getDraft(rowKey, prop);
    if (!draft.has) return;
    deleteDraft(rowKey, prop);
    deps.setCellValue(row, rowIndex, prop, draft.value);
  }

  /** 丢弃某行所有未提交的草稿（row 模式取消编辑 / 行被删除时调用，不写回） */
  function discardDraftsForRow(rowKey: string): void {
    if (drafts.delete(rowKey)) bumpSessionEpochFor(rowKey);
  }

  function flushRowDrafts(rowKey: string): void {
    bumpSessionEpochFor(rowKey);
    const found = coreStates.keysMap.value.get(rowKey);
    if (!found) {
      discardDraftsForRow(rowKey);
      return;
    }
    const props = [...(drafts.get(rowKey)?.keys() ?? [])];
    for (const prop of props) {
      flushDraft(found.row, found.rowIndex, rowKey, prop);
    }
  }

  function endEditingRowSession(): void {
    states.editingRowKey.value = null;
    editingRowSnapshot = null;
    bumpSessionEpoch();
  }

  function clearEditingRow(flush = true): void {
    const rowKey = states.editingRowKey.value;
    if (!rowKey) return;

    if (flush) flushRowDrafts(rowKey);
    else discardDraftsForRow(rowKey);

    const current = editingRef.value;
    if (current?.rowKey === rowKey) setEditingCell(null);

    endEditingRowSession();
  }

  /** 数据行身份失效时调用：丢弃该 rowKey 下全部编辑上下文，不把旧草稿写入新行。 */
  function invalidateEditingRow(rowKey: string): void {
    discardDraftsForRow(rowKey);
    if (editingRef.value?.rowKey === rowKey) setEditingCell(null);
    if (states.editingRowKey.value === rowKey) {
      endEditingRowSession();
    }
  }

  function isLocatedCellEditable(cell: CellLocation<T>): boolean {
    return (
      coreStates.mode.value !== 'none' &&
      resolveEditable(cell.row, cell.rowIndex, cell.node.column) &&
      !deps.getDependencyState(cell.row, cell.rowIndex, cell.node).disabled
    );
  }

  function canEditCell(rowIndex: number, colIndex: number): boolean {
    const cell = deps.locateCell(rowIndex, colIndex);
    return !!cell && isLocatedCellEditable(cell);
  }

  function isRowEditing(row: T): boolean {
    return states.editingRowKey.value === core.getRowKey(row);
  }

  function isEditingRef(rowKey: string, colId: string): boolean {
    return editingCells.has(cellRefKey(rowKey, colId));
  }

  /** 单元格是否处于编辑器渲染态（三种模式统一入口） */
  function isCellEditing(rowIndex: number, colIndex: number): boolean {
    switch (coreStates.mode.value) {
      case 'table':
        return canEditCell(rowIndex, colIndex);
      case 'row': {
        const row = coreStates.data.value[rowIndex];
        return !!row && isRowEditing(row) && canEditCell(rowIndex, colIndex);
      }
      case 'cell': {
        const ref = deps.toCellRef(rowIndex, colIndex);
        return !!ref && isEditingRef(ref.rowKey, ref.colId);
      }
      default:
        return false;
    }
  }

  async function focusEditor(ref: CellRef, hasInitialValue: boolean) {
    await nextTick();
    const cellEl = deps.getCellElRef(ref);
    focusEditorElement(cellEl, {
      select: hasInitialValue ? 'end' : 'all',
      skipIfFocused: true,
    });
  }

  /** cell 模式进编；defaultValue 用于可打印字符覆盖式进编 */
  function startEdit(
    rowIndex: number,
    colIndex: number,
    opts: { defaultValue?: unknown } = {},
  ): boolean {
    if (coreStates.mode.value !== 'cell') return false;
    const ref = deps.toCellRef(rowIndex, colIndex);
    if (!ref) return false;
    const cell = deps.locateCellRef(ref);
    if (!cell || !isLocatedCellEditable(cell)) return false;
    if (editingRef.value) commitEdit();
    const hasInitial = 'defaultValue' in opts;
    setDraft(cell.rowKey, cell.prop, hasInitial ? opts.defaultValue : cell.row[cell.prop]);
    setEditingCell(ref);
    deps.setCurrentCell(rowIndex, colIndex);
    void focusEditor(ref, hasInitial);
    return true;
  }

  /** cell 模式提交：经 setCellValue 流水线（脏值跳过 / 联动 / 校验） */
  function commitEdit(): void {
    if (coreStates.mode.value !== 'cell') return;
    const current = editingRef.value;
    if (!current) return;
    setEditingCell(null);
    const cell = deps.locateCellRef(current);
    if (!cell) {
      deleteRefDraft(current);
      return;
    }
    const draft = getDraft(cell.rowKey, cell.prop);
    if (!draft.has) return;
    deleteDraft(cell.rowKey, cell.prop);
    deps.setCellValue(cell.row, cell.rowIndex, cell.prop, draft.value);
  }

  function cancelEdit(): void {
    if (coreStates.mode.value !== 'cell') return;
    const current = editingRef.value;
    if (!current) return;
    setEditingCell(null);
    deleteRefDraft(current);
  }

  function clearRowEditingCell(flush = false): void {
    const current = editingRef.value;
    if (!current || coreStates.mode.value !== 'row') return;
    const cell = deps.locateCellRef(current);
    if (flush && cell) flushDraft(cell.row, cell.rowIndex, cell.rowKey, cell.prop);
    setEditingCell(null);
    deleteRefDraft(current);
  }

  /** row 模式：在已进编的行上设置当前格编辑器 */
  function setRowEditingCell(rowIndex: number, colIndex: number): boolean {
    if (coreStates.mode.value !== 'row') return false;
    const ref = deps.toCellRef(rowIndex, colIndex);
    if (!ref) return false;
    const cell = deps.locateCellRef(ref);
    if (!cell || !isRowEditing(cell.row) || !isLocatedCellEditable(cell)) {
      return false;
    }
    clearRowEditingCell(true);
    setDraft(cell.rowKey, cell.prop, cell.row[cell.prop]);
    setEditingCell(ref);
    deps.setCurrentCell(rowIndex, colIndex, false);
    void focusEditor(ref, false);
    return true;
  }

  function startRowEdit(rowIndex: number): boolean {
    if (coreStates.mode.value !== 'row') return false;
    const row = coreStates.data.value[rowIndex];
    if (!row) return false;
    const key = core.getRowKey(row);
    if (states.editingRowKey.value === key) return true;
    clearEditingRow(true);
    editingRowSnapshot = cloneDeep(row);
    states.editingRowKey.value = key;
    bumpSessionEpoch();
    return true;
  }

  /** row 模式提交：整行校验通过才退出编辑态 */
  async function commitRowEdit(rowIndex: number): Promise<boolean> {
    const row = coreStates.data.value[rowIndex];
    if (!row) return false;
    const key = core.getRowKey(row);
    if (states.editingRowKey.value !== key) return false;
    flushRowDrafts(key);
    setEditingCell(null);
    // 本次提交自身的写入已全部落地，此后纪元再变说明校验期间又发生了编辑
    const epoch = editingSessionEpoch;
    const errors = await deps.validateRow(rowIndex);
    if (errors.length) return false;
    const currentLocation = coreStates.keysMap.value.get(key);
    if (
      editingSessionEpoch !== epoch ||
      states.editingRowKey.value !== key ||
      currentLocation?.row !== row
    ) {
      return false;
    }
    endEditingRowSession();
    return true;
  }

  /** row 模式取消：静默回滚到快照（不触发联动与 cell-change） */
  function cancelRowEdit(rowIndex: number): void {
    const row = coreStates.data.value[rowIndex];
    if (!row) return;
    const key = core.getRowKey(row);
    if (states.editingRowKey.value !== key) return;
    setEditingCell(null);
    // 未提交的草稿本来就没写进 row，直接丢弃即可；不能 flush，否则等于强行提交取消中的编辑
    discardDraftsForRow(key);
    const dirtyProps = new Set(Object.keys(row));
    const snapshot = editingRowSnapshot;
    if (snapshot) {
      for (const prop of Object.keys(snapshot)) dirtyProps.add(prop);
      // 逐字段经写契约回滚，快照里没有的键按同样的 rowKey 保护删除
      for (const prop of Object.keys(row)) {
        if (!(prop in snapshot)) deps.deleteRowField(row, prop);
      }
      for (const [prop, value] of Object.entries(cloneDeep(snapshot))) {
        deps.writeRowField(row, prop, value);
      }
    }
    for (const prop of dirtyProps) deps.markDirty(key, prop);
    endEditingRowSession();
    deps.clearRowValidate(row);
  }

  return {
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
    discardDraftsForRow,
    invalidateEditingRow,
    states,
  };
}
