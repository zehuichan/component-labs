import { nextTick } from 'vue';
import { clamp } from 'es-toolkit';
import { focusEditorElement } from '../utils';
import { useCellRefSlot } from './use-cell-ref';
import type { TableHost } from '../table';
import type { CellLocation, CellPosition, CellRef, RowData } from '../types';
import type { UseColumnsReturn } from './use-columns';
import type { UseDataReturn } from './use-data';

type UseCurrentProps<T extends RowData> = Pick<UseDataReturn<T>, 'data' | 'keysMap' | 'getRowKey'> &
  Pick<UseColumnsReturn<T>, 'columns' | 'getColumnIndex'> &
  Pick<TableHost<T>, 'gridRef' | 'ids'>;

/** 活动格：稳定身份 ↔ 公开下标的换算、导航移动、DOM 定位与聚焦。 */
export function useCurrent<T extends RowData = RowData>({
  data,
  keysMap,
  getRowKey,
  columns,
  getColumnIndex,
  gridRef,
  ids,
}: UseCurrentProps<T>) {
  const rowCount = () => data.value.length;
  const colCount = () => columns.value.length;

  /** 公开下标调用边界进入内部稳定身份。 */
  function toCellRef(rowIndex: number, colIndex: number): CellRef | null {
    const row = data.value[rowIndex];
    const node = columns.value[colIndex];
    return row && node ? { rowKey: getRowKey(row), colId: node.id } : null;
  }

  /** 按最新行列顺序把稳定身份解析回公开位置。 */
  function resolveCellPosition(ref: CellRef): CellPosition | null {
    const rowIndex = keysMap.value.get(ref.rowKey)?.rowIndex;
    const colIndex = getColumnIndex(ref.colId);
    return rowIndex === undefined || colIndex < 0 ? null : { rowIndex, colIndex };
  }

  /** 把稳定身份解析为完整单元格上下文。 */
  function locateCellRef(ref: CellRef): CellLocation<T> | null {
    const position = resolveCellPosition(ref);
    if (!position) return null;
    const row = data.value[position.rowIndex];
    const node = columns.value[position.colIndex];
    const prop = node?.column.prop;
    if (!row || !node || !prop) return null;
    return { ...position, row, node, prop, rowKey: ref.rowKey };
  }

  function locateCell(rowIndex: number, colIndex: number): CellLocation<T> | null {
    const ref = toCellRef(rowIndex, colIndex);
    return ref ? locateCellRef(ref) : null;
  }

  const slot = useCellRefSlot({ toCellRef, resolveCellPosition });
  /** 对外按当前行列顺序呈现的活动格下标位置。 */
  const currentCell = slot.position;

  function getCurrentRef(): CellRef | null {
    return slot.get();
  }

  function resolveCurrentPosition(): CellPosition | null {
    const ref = slot.get();
    return ref ? resolveCellPosition(ref) : null;
  }

  function getCurrentCellLocation(): CellLocation<T> | null {
    const ref = slot.get();
    return ref ? locateCellRef(ref) : null;
  }

  /** 直接按实例内稳定 cell id 定位，不依赖 Element Plus 当前 DOM 行顺序。 */
  function getCellElRef(ref: CellRef): HTMLElement | null {
    const grid = gridRef.value;
    if (!grid) return null;
    return grid.querySelector<HTMLElement>(`#${CSS.escape(ids.cell(ref.rowKey, ref.colId))}`);
  }

  function getCellEl(rowIndex: number, colIndex: number): HTMLElement | null {
    const ref = toCellRef(rowIndex, colIndex);
    return ref ? getCellElRef(ref) : null;
  }

  function scrollCellRef(ref: CellRef): void {
    getCellElRef(ref)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function scrollCellIntoView(rowIndex: number, colIndex: number): void {
    const ref = toCellRef(rowIndex, colIndex);
    if (ref) scrollCellRef(ref);
  }

  function setCurrentCell(rowIndex: number, colIndex: number, scroll = true): void {
    const rows = rowCount();
    const cols = colCount();
    const next =
      rows && cols ? toCellRef(clamp(rowIndex, 0, rows - 1), clamp(colIndex, 0, cols - 1)) : null;
    slot.set(next);
    if (next && scroll) scrollCellRef(next);
  }

  /** 无可解析活动格时选择首格并返回 null，让本次移动立即停止。 */
  function resolveMoveOrigin(): CellPosition | null {
    const position = resolveCurrentPosition();
    if (position) return position;
    setCurrentCell(0, 0);
    return null;
  }

  function isCurrentRef(rowKey: string, colId: string): boolean {
    return slot.has(rowKey, colId);
  }

  function isCurrentCell(rowIndex: number, colIndex: number): boolean {
    const ref = toCellRef(rowIndex, colIndex);
    return !!ref && slot.has(ref.rowKey, ref.colId);
  }

  /** 数据行身份失效时调用：清掉该 rowKey 上的活动格。 */
  function invalidateCurrentRow(rowKey: string): void {
    if (slot.get()?.rowKey === rowKey) slot.set(null);
  }

  /** 列显隐 / 重排后活动格若已无法解析，直接清掉。 */
  function cleanCurrent(): void {
    if (!resolveCurrentPosition()) slot.set(null);
  }

  /** 方向移动（不换行），无活动格时落到首格 */
  function moveCurrent(deltaRow: number, deltaCol: number): void {
    const position = resolveMoveOrigin();
    if (position) setCurrentCell(position.rowIndex + deltaRow, position.colIndex + deltaCol);
  }

  /** 顺序移动（Tab 流，行尾换行），无活动格时落到首格 */
  function moveSequential(delta: number): void {
    const cols = colCount();
    const total = rowCount() * cols;
    if (total === 0) return;
    const position = resolveMoveOrigin();
    if (!position) return;
    const flat = clamp(position.rowIndex * cols + position.colIndex + delta, 0, total - 1);
    setCurrentCell(Math.floor(flat / cols), flat % cols);
  }

  function moveToRowEdge(end: boolean): void {
    const position = resolveMoveOrigin();
    if (position) setCurrentCell(position.rowIndex, end ? colCount() - 1 : 0);
  }

  function moveToTableCorner(end: boolean): void {
    if (end) setCurrentCell(rowCount() - 1, colCount() - 1);
    else setCurrentCell(0, 0);
  }

  function focusGrid(): void {
    gridRef.value?.focus({ preventScroll: true });
  }

  /**
   * row/table 模式下编辑器随格子常驻渲染，移动高亮态之后若不把真实 DOM 焦点
   * 也同步过去，用户看到高亮跳到了新格子，但键入内容却还是灌进旧格子的输入框。
   */
  function focusCurrentCellEditor(): void {
    const current = slot.get();
    if (!current) return;
    void nextTick(() => {
      if (slot.get() !== current) return;
      const focused = focusEditorElement(getCellElRef(current), {
        preventScroll: true,
        select: 'all',
        skipIfFocused: true,
      });
      if (!focused) focusGrid();
    });
  }

  return {
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
  };
}

export type UseCurrentReturn<T extends RowData = RowData> = ReturnType<typeof useCurrent<T>>;
