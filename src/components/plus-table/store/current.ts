import { computed, nextTick, reactive, shallowRef, type ComputedRef } from 'vue';
import { clamp, isEqual } from 'es-toolkit';
import { focusEditorElement } from '../util';
import type { TableCoreContext } from './context';
import type { RowData } from '../table/defaults';
import type { ColumnNode } from '../table-column/defaults';

export interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

/** 表格内部的稳定单元格身份；公开 API 仍只使用 CellPosition。 */
export interface CellRef {
  rowKey: string;
  colId: string;
}

/**
 * reactive Set 使用的内部 key。rowKey 经 getRowIdentity 归一化、colId 由列归一化生成，
 * 两者都是组件内部的稳定字符串且不含 \0，用它作分隔符即可避免拼接碰撞，
 * 又省掉活动格 / 编辑态判定这条高频路径上的 JSON 序列化。
 */
export function cellRefKey(rowKey: string, colId: string): string {
  return `${rowKey}\0${colId}`;
}

export interface CurrentDeps<T extends RowData = RowData> {
  /** 当前可导航的叶子数据列（受列设置显隐 / 排序影响） */
  columns: ComputedRef<ColumnNode<T>[]>;
  getColumnIndex: (columnKey: string) => number;
}

export function useCurrent<T extends RowData = RowData>(
  core: TableCoreContext<T>,
  deps: CurrentDeps<T>,
) {
  const { host, states: coreStates } = core;
  const currentRef = shallowRef<CellRef | null>(null);
  const states = {
    /** 兼容公开 Store：对外仍按当前行列顺序呈现下标位置。 */
    currentCell: computed<CellPosition | null>({
      get: (previous) => {
        const next = resolveCurrentPosition();
        return isEqual(previous, next) ? (previous ?? null) : next;
      },
      set: (next) => {
        setCurrentRef(next ? toCellRef(next.rowIndex, next.colIndex) : null);
      },
    }),
  };
  /** 按 key 订阅活动态，只让旧格和新格的渲染失效。 */
  const currentCells = reactive(new Set<string>());

  function rowCount(): number {
    return coreStates.data.value.length;
  }

  function colCount(): number {
    return deps.columns.value.length;
  }

  /** 把下标钳制到 [0, max-1]（max 为 0 时钳制到 0，交由调用方按 rowCount/colCount 判空） */
  function clampIndex(value: number, max: number): number {
    return clamp(value, 0, Math.max(max - 1, 0));
  }

  function setCurrentRef(next: CellRef | null): void {
    const current = currentRef.value;
    if (
      current === next ||
      (current && next && current.rowKey === next.rowKey && current.colId === next.colId)
    ) {
      return;
    }
    if (current) currentCells.delete(cellRefKey(current.rowKey, current.colId));
    currentRef.value = next;
    if (next) currentCells.add(cellRefKey(next.rowKey, next.colId));
  }

  function getCurrentRef(): CellRef | null {
    return currentRef.value;
  }

  /** 公开下标调用边界进入内部稳定身份。 */
  function toCellRef(rowIndex: number, colIndex: number): CellRef | null {
    const row = coreStates.data.value[rowIndex];
    const node = deps.columns.value[colIndex];
    if (!row || !node) return null;
    return { rowKey: core.getRowKey(row), colId: node.id };
  }

  /** 按最新行列顺序把稳定身份解析回公开位置。 */
  function resolveCellPosition(ref: CellRef): CellPosition | null {
    const rowIndex = coreStates.keysMap.value.get(ref.rowKey)?.rowIndex;
    const colIndex = deps.getColumnIndex(ref.colId);
    if (rowIndex === undefined || colIndex < 0) return null;
    return { rowIndex, colIndex };
  }

  function resolveCurrentPosition(): CellPosition | null {
    const current = currentRef.value;
    return current ? resolveCellPosition(current) : null;
  }

  /** 直接按实例内稳定 cell id 定位，不依赖 Element Plus 当前 DOM 行顺序。 */
  function getCellElRef(ref: CellRef): HTMLElement | null {
    const grid = host.gridRef.value;
    if (!grid) return null;
    return grid.querySelector<HTMLElement>(`#${CSS.escape(host.ids.cell(ref.rowKey, ref.colId))}`);
  }

  function getCellEl(rowIndex: number, colIndex: number): HTMLElement | null {
    const ref = toCellRef(rowIndex, colIndex);
    return ref ? getCellElRef(ref) : null;
  }

  function scrollCellRef(ref: CellRef) {
    getCellElRef(ref)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }

  function scrollCellIntoView(rowIndex: number, colIndex: number) {
    const ref = toCellRef(rowIndex, colIndex);
    if (ref) scrollCellRef(ref);
  }

  function setCurrentCell(rowIndex: number, colIndex: number, scroll = true) {
    if (rowCount() === 0 || colCount() === 0) {
      setCurrentRef(null);
      return;
    }
    const nextPosition: CellPosition = {
      rowIndex: clampIndex(rowIndex, rowCount()),
      colIndex: clampIndex(colIndex, colCount()),
    };
    const next = toCellRef(nextPosition.rowIndex, nextPosition.colIndex);
    if (!next) {
      setCurrentRef(null);
      return;
    }
    setCurrentRef(next);
    if (scroll) scrollCellRef(next);
  }

  /** 无可解析活动格时选择首格并返回 null，让本次移动立即停止。 */
  function resolveMoveOrigin(): CellPosition | null {
    const position = resolveCurrentPosition();
    if (position) return position;
    setCurrentCell(0, 0);
    return null;
  }

  function isCurrentRef(rowKey: string, colId: string): boolean {
    return currentCells.has(cellRefKey(rowKey, colId));
  }

  function isCurrentCell(rowIndex: number, colIndex: number): boolean {
    const ref = toCellRef(rowIndex, colIndex);
    return !!ref && isCurrentRef(ref.rowKey, ref.colId);
  }

  /** 数据行身份失效时调用：清掉该 rowKey 上的活动格。 */
  function invalidateCurrentRow(rowKey: string): void {
    if (currentRef.value?.rowKey === rowKey) setCurrentRef(null);
  }

  function cleanCurrent(): void {
    if (!resolveCurrentPosition()) setCurrentRef(null);
  }

  /** 方向移动（不换行），无活动格时落到首格 */
  function moveCurrent(deltaRow: number, deltaCol: number) {
    const position = resolveMoveOrigin();
    if (!position) return;
    setCurrentCell(position.rowIndex + deltaRow, position.colIndex + deltaCol);
  }

  /** 顺序移动（Tab 流，行尾换行），无活动格时落到首格 */
  function moveSequential(delta: number) {
    const cols = colCount();
    const total = rowCount() * cols;
    if (total === 0 || cols === 0) return;
    const position = resolveMoveOrigin();
    if (!position) return;
    const flat = clamp(position.rowIndex * cols + position.colIndex + delta, 0, total - 1);
    setCurrentCell(Math.floor(flat / cols), flat % cols);
  }

  function moveToRowEdge(end: boolean) {
    const position = resolveMoveOrigin();
    if (!position) return;
    setCurrentCell(position.rowIndex, end ? colCount() - 1 : 0);
  }

  function moveToTableCorner(end: boolean) {
    if (end) setCurrentCell(rowCount() - 1, colCount() - 1);
    else setCurrentCell(0, 0);
  }

  function focusGrid() {
    host.gridRef.value?.focus({ preventScroll: true });
  }

  /**
   * row/table 模式下，编辑器随格子常驻渲染，移动高亮态之后若不把真实 DOM 焦点
   * 也同步过去，用户看到高亮跳到了新格子，但键入内容却还是灌进旧格子的输入框。
   */
  function focusCurrentCellEditor() {
    const current = currentRef.value;
    if (!current) return;
    void nextTick(() => {
      if (currentRef.value !== current) return;
      const cellEl = getCellElRef(current);
      if (
        !focusEditorElement(cellEl, {
          preventScroll: true,
          select: 'all',
          skipIfFocused: true,
        })
      ) {
        focusGrid();
      }
    });
  }

  return {
    isCurrentCell,
    isCurrentRef,
    setCurrentCell,
    getCurrentRef,
    toCellRef,
    resolveCellPosition,
    invalidateCurrentRow,
    cleanCurrent,
    moveCurrent,
    moveSequential,
    moveToRowEdge,
    moveToTableCorner,
    getCellEl,
    getCellElRef,
    scrollCellIntoView,
    scrollCellRef,
    focusGrid,
    focusCurrentCellEditor,
    states,
  };
}
