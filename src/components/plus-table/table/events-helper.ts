import { isFunction } from 'es-toolkit';
import { isControl } from '../util';
import { DEFAULT_PROPS } from './defaults';
import type { PlusTable } from '../tokens';
import type { ResolvedMenuItem } from '../table-context-menu/types';
import type { ContextMenuContext, ContextMenuItem, RowData } from './defaults';

export function useEvents<T extends RowData = RowData>(table: PlusTable<T>) {
  function handlePageChange(page: number) {
    table.emit('update:page', page);
    table.emit('page-change', { page, pageSize: table.props.pageSize! });
  }

  function handlePageSizeChange(pageSize: number) {
    table.emit('update:pageSize', pageSize);
    table.emit('page-change', { page: table.props.page!, pageSize });
  }

  /** 表头拖拽调宽（el-table 需 border 才出现拖拽柄），记录并持久化 */
  function handleHeaderDragend(
    newWidth: number,
    _oldWidth: number,
    column: { columnKey?: string },
  ) {
    if (column.columnKey) table.store.setColumnWidth(column.columnKey, newWidth);
  }

  function isContextMenuEnabled() {
    return table.props.contextMenuEnabled ?? DEFAULT_PROPS.contextMenuEnabled;
  }

  /** 表头右键：内置「隐藏 / 设置」；columnKey 渲染时已设为 node.id */
  function handleHeaderContextmenu(column: { columnKey?: string }, event: MouseEvent) {
    if (!isContextMenuEnabled() || !column.columnKey) return;
    const columnId = column.columnKey;
    const setting = table.store.settingItems.value.find((item) => item.id === columnId);
    const hideDisabled = !!setting?.disabled;
    const items: ResolvedMenuItem[] = [
      {
        key: 'hide',
        label: '隐藏',
        disabled: hideDisabled,
        handler: () => {
          if (hideDisabled) return;
          table.store.toggleColumnVisible(columnId, false);
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
   * 而不是 DOM cell.cellIndex——特殊列作为真实 <td> 渲染但不进 states.columns。
   */
  function getCellPosition(row: T, column: { columnKey?: string }) {
    const rowKey = table.store.getRowKey(row);
    const rowIndex = table.store.states.keysMap.value.get(rowKey)?.rowIndex ?? -1;
    const colIndex = column.columnKey ? table.store.getColumnIndex(column.columnKey) : -1;
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
    if (!isContextMenuEnabled()) return;
    if (isControl(event.target, cell)) return;

    const { rowIndex, colIndex } = getCellPosition(row, column);
    if (rowIndex < 0) return;
    if (colIndex >= 0) table.store.setCurrentCell(rowIndex, colIndex, false);

    const node = colIndex >= 0 ? (table.store.states.columns.value[colIndex] ?? null) : null;
    const ctx: ContextMenuContext<T> = {
      event,
      row,
      rowIndex,
      colIndex,
      prop: node?.column.prop,
      column: node?.column ?? null,
      data: table.store.states.data.value,
    };
    table.contextMenuRef.value?.open(event, resolveCellMenuItems(ctx));
  }

  function handleCellClick(
    row: T,
    column: { columnKey?: string },
    _cell: HTMLElement,
    event: Event,
  ) {
    const mode = table.store.states.mode.value;
    const { rowIndex, colIndex } = getCellPosition(row, column);
    if (rowIndex < 0 || colIndex < 0) return;
    table.store.setCurrentCell(rowIndex, colIndex, false);

    const fromControl = isControl(event.target, _cell);
    if (mode === 'row' && table.store.isRowEditing(row)) {
      if (table.store.canEditCell(rowIndex, colIndex)) {
        const editing = table.store.getEditingCellLocation();
        if (!fromControl || editing?.rowIndex !== rowIndex || editing.colIndex !== colIndex) {
          table.store.setRowEditingCell(rowIndex, colIndex);
        }
      } else {
        table.store.clearRowEditingCell(true);
        if (!fromControl) table.store.focusGrid();
      }
      return;
    }

    // 点击真实控件时保留其原生焦点；table 模式的空白区域则把焦点交给当前格编辑器。
    if (fromControl) return;
    if (mode === 'table') table.store.focusCurrentCellEditor();
    else table.store.focusGrid();
  }

  function handleCellDblclick(row: T, column: { columnKey?: string }, _cell: HTMLElement) {
    const mode = table.store.states.mode.value;
    const { rowIndex, colIndex } = getCellPosition(row, column);
    if (rowIndex < 0) return;
    if (mode === 'cell' && colIndex >= 0) {
      table.store.startEdit(rowIndex, colIndex);
    } else if (mode === 'row') {
      table.store.startRowEdit(rowIndex);
      if (colIndex >= 0) table.store.setRowEditingCell(rowIndex, colIndex);
    }
  }

  return {
    handlePageChange,
    handlePageSizeChange,
    handleHeaderDragend,
    handleHeaderContextmenu,
    handleCellContextmenu,
    getCellPosition,
    handleCellClick,
    handleCellDblclick,
  };
}
