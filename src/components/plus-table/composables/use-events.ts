import { isFunction } from 'es-toolkit';
import { isControl } from '../utils';
import type { ResolvedMenuItem } from '../context-menu';
import type { ContextMenuContext, ContextMenuItem } from '../table';
import type { PlusTableContext } from '../tokens';
import type { RowData } from '../types';

/**
 * el-table 回传事件 → PlusTable 行为。接收整份上下文而不是拆成 props + deps：
 * 它在根组件完成 provide 之后才接线，消费面几乎覆盖所有模块，逐项列举只会更啰嗦。
 */
export function useEvents<T extends RowData = RowData>(table: PlusTableContext<T>) {
  function handlePageChange(page: number) {
    table.emit('update:page', page);
    table.emit('page-change', { page, pageSize: table.props.pageSize });
  }

  function handlePageSizeChange(pageSize: number) {
    table.emit('update:pageSize', pageSize);
    table.emit('page-change', { page: table.props.page, pageSize });
  }

  /** 表头拖拽调宽（el-table 需 border 才出现拖拽柄），记录并持久化 */
  function handleHeaderDragend(
    newWidth: number,
    _oldWidth: number,
    column: { columnKey?: string },
  ) {
    if (column.columnKey) table.setColumnWidth(column.columnKey, newWidth);
  }

  /** 表头右键：内置「隐藏 / 设置」；columnKey 渲染时已设为 node.id */
  function handleHeaderContextmenu(column: { columnKey?: string }, event: MouseEvent) {
    if (!table.props.contextMenuEnabled || !column.columnKey) return;
    const columnId = column.columnKey;
    const setting = table.settingItems.value.find((item) => item.id === columnId);
    const hideDisabled = !!setting?.disabled;
    const items: ResolvedMenuItem[] = [
      {
        key: 'hide',
        label: '隐藏',
        disabled: hideDisabled,
        handler: () => {
          if (hideDisabled) return;
          table.toggleColumnVisible(columnId, false);
        },
      },
      {
        key: 'settings',
        label: '设置',
        handler: () => {
          table.columnSettingsRef.value?.open();
        },
      },
    ];
    table.contextMenuRef.value?.open(event, items);
  }

  /**
   * 用 el-table 回传的 column.columnKey（渲染时已设为 node.id）查找列下标，
   * 而不是 DOM cell.cellIndex——特殊列作为真实 <td> 渲染但不进 columns。
   */
  function getCellPosition(row: T, column: { columnKey?: string }) {
    const rowKey = table.getRowKey(row);
    const rowIndex = table.keysMap.value.get(rowKey)?.rowIndex ?? -1;
    const colIndex = column.columnKey ? table.getColumnIndex(column.columnKey) : -1;
    return { rowIndex, colIndex };
  }

  function resolveCellMenuItems(ctx: ContextMenuContext<T>): ResolvedMenuItem[] {
    const source = table.props.contextMenu;
    if (!source) return [];
    const raw = isFunction(source) ? source(ctx) : source;
    const resolved: ResolvedMenuItem[] = [];
    for (let index = 0; index < raw.length; index++) {
      const item = raw[index] as ContextMenuItem<T>;
      if (item.when && !item.when(ctx)) continue;
      const disabled = isFunction(item.disabled) ? !!item.disabled(ctx) : !!item.disabled;
      resolved.push({
        key: item.key ?? `${item.label}-${index}`,
        label: item.label,
        disabled,
        separator: item.separator,
        closeOnSelect: item.closeOnSelect,
        slotProps: ctx as unknown as Record<string, unknown>,
        handler: () => item.handler(ctx),
      });
    }
    return resolved;
  }

  function handleCellContextmenu(
    row: T,
    column: { columnKey?: string },
    cell: HTMLElement,
    event: MouseEvent,
  ) {
    if (!table.props.contextMenuEnabled) return;
    if (isControl(event.target, cell)) return;

    const { rowIndex, colIndex } = getCellPosition(row, column);
    if (rowIndex < 0) return;
    if (colIndex >= 0) table.setCurrentCell(rowIndex, colIndex, false);

    const node = colIndex >= 0 ? (table.columns.value[colIndex] ?? null) : null;
    const ctx: ContextMenuContext<T> = {
      event,
      row,
      rowIndex,
      colIndex,
      prop: node?.column.prop,
      column: node?.column ?? null,
      data: table.data.value,
    };
    table.contextMenuRef.value?.open(event, resolveCellMenuItems(ctx));
  }

  function handleCellClick(
    row: T,
    column: { columnKey?: string },
    cell: HTMLElement,
    event: Event,
  ) {
    const mode = table.props.mode;
    const { rowIndex, colIndex } = getCellPosition(row, column);
    if (rowIndex < 0 || colIndex < 0) return;
    table.setCurrentCell(rowIndex, colIndex, false);

    const fromControl = isControl(event.target, cell);
    if (mode === 'row' && table.isRowEditing(row)) {
      if (table.canEditCell(rowIndex, colIndex)) {
        const editing = table.getEditingCellLocation();
        if (!fromControl || editing?.rowIndex !== rowIndex || editing.colIndex !== colIndex) {
          table.setRowEditingCell(rowIndex, colIndex);
        }
      } else {
        table.clearRowEditingCell(true);
        if (!fromControl) table.focusGrid();
      }
      return;
    }

    // 点击真实控件时保留其原生焦点；table 模式的空白区域则把焦点交给当前格编辑器。
    if (fromControl) return;
    if (mode === 'table') table.focusCurrentCellEditor();
    else table.focusGrid();
  }

  function handleCellDblclick(row: T, column: { columnKey?: string }, _cell: HTMLElement) {
    const mode = table.props.mode;
    const { rowIndex, colIndex } = getCellPosition(row, column);
    if (rowIndex < 0) return;
    if (mode === 'cell' && colIndex >= 0) {
      table.startEdit(rowIndex, colIndex);
    } else if (mode === 'row') {
      table.startRowEdit(rowIndex);
      if (colIndex >= 0) table.setRowEditingCell(rowIndex, colIndex);
    }
  }

  return {
    handlePageChange,
    handlePageSizeChange,
    handleHeaderDragend,
    handleHeaderContextmenu,
    handleCellContextmenu,
    handleCellClick,
    handleCellDblclick,
  };
}

export type UseEventsReturn<T extends RowData = RowData> = ReturnType<typeof useEvents<T>>;
