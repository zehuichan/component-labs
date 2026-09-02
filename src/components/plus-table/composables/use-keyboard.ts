import { partition } from 'es-toolkit';
import { typedCharToDraft } from '../adapter';
import type { HotkeyBinding, HotkeyContext } from '../table';
import type { PlusTableContext } from '../tokens';
import type { RowData } from '../types';

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/** 没有文本插入符的 input type：其上的方向键 / Delete 不具备本地编辑语义 */
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** Enter 带原生激活语义的控件（操作列按钮、链接、菜单项等），网格不得抢走 */
const NATIVE_ENTER_SELECTOR = [
  'button',
  'a[href]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  '[role~="button"]',
  '[role~="link"]',
  '[role~="menuitem"]',
  '[role~="menuitemcheckbox"]',
  '[role~="menuitemradio"]',
  '[role~="option"]',
].join(', ');

/** 焦点在控件内部时这次按键的归属：网格导航（grid）或编辑器本地（editor） */
type KeyRoute = 'grid' | 'editor';

interface ActiveEditorKeyActions {
  cancel: () => void;
  commit: () => void;
  afterMove: () => void;
}

function isIme(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return target instanceof HTMLElement && target.isContentEditable === true;
}

function hasNativeEnterAction(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(NATIVE_ENTER_SELECTOR);
}

function isTextAreaLineBreak(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return target instanceof HTMLTextAreaElement && (event.shiftKey || event.altKey);
}

/**
 * 焦点落在编辑器控件内部时，判断这次按键归网格还是归控件自身。
 * table 模式编辑器常驻、row 模式整行编辑器常驻，焦点几乎永远在控件里，
 * 若一律让位给原生行为，键盘就再也走不出这一格（自锁）。
 */
function routeKey(event: KeyboardEvent): KeyRoute {
  if (isIme(event)) return 'editor';
  const ctrl = event.ctrlKey || event.metaKey;
  switch (event.key) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'Tab':
    case 'Escape':
    case 'F2':
      return 'grid';
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'Home':
    case 'End':
      // 文本控件里不带 Ctrl 的左右 / 行首尾是插入符移动，网格不能抢
      return ctrl || !isTextEntry(event.target) ? 'grid' : 'editor';
    case 'Delete':
    case 'Backspace':
      return isTextEntry(event.target) ? 'editor' : 'grid';
    case 'Enter':
      return isTextAreaLineBreak(event) || hasNativeEnterAction(event.target) ? 'editor' : 'grid';
    default: {
      const key = event.key.toLowerCase();
      return ctrl && (key === 'z' || key === 'y') ? 'grid' : 'editor';
    }
  }
}

function isPrintableKey(event: KeyboardEvent): boolean {
  return (
    !isIme(event) && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}

/** 'Ctrl+Shift+Z' 风格组合键字符串与 KeyboardEvent 比对，大小写不敏感 */
function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
  const parts = hotkey
    .toLowerCase()
    .split('+')
    .map((s) => s.trim());
  const mainKey = parts.find((p) => !['ctrl', 'shift', 'alt', 'meta'].includes(p));
  if (!mainKey) return false;
  return (
    event.ctrlKey === parts.includes('ctrl') &&
    event.shiftKey === parts.includes('shift') &&
    event.altKey === parts.includes('alt') &&
    event.metaKey === parts.includes('meta') &&
    event.key.toLowerCase() === mainKey
  );
}

/**
 * 仿 Excel 键盘流。监听挂在表格外层容器（tabindex=0），
 * 编辑器内的按键经冒泡到达这里，按编辑态分流处理。
 * 与 useEvents 一样接收整份上下文：接线发生在 provide 之后，消费面覆盖大半模块。
 */
export function useKeyboard<T extends RowData = RowData>(table: PlusTableContext<T>) {
  function buildContext(event: KeyboardEvent): HotkeyContext<T> {
    const cell = table.getCurrentCellLocation();
    const rowIndex = cell?.rowIndex ?? -1;
    const colIndex = cell?.colIndex ?? -1;
    const row = cell?.row ?? null;
    const column = cell?.node.column ?? null;
    return {
      event,
      rowIndex,
      colIndex,
      row,
      prop: cell?.prop,
      column,
      data: table.data.value,
      navigate: (rowDelta, colDelta) => table.moveCurrent(rowDelta, colDelta),
      startEdit: () => {
        if (cell) table.startEdit(cell.rowIndex, cell.colIndex);
      },
      cancelEdit: () => table.cancelEdit(),
      setValue: (value) => {
        if (!cell) return;
        table.setCellValue(cell.row, cell.rowIndex, cell.prop, value);
      },
      undo: table.undo,
      redo: table.redo,
    };
  }

  function getCustomHotkeys(): HotkeyBinding<T>[] {
    if (!table.props.hotkeyEnabled) return [];
    return table.props.hotkeys ?? [];
  }

  function runHotkeyBindings(bindings: HotkeyBinding<T>[], event: KeyboardEvent): boolean {
    for (const binding of bindings) {
      if (!matchesHotkey(event, binding.key)) continue;
      const ctx = buildContext(event);
      if (binding.when && !binding.when(ctx)) continue;
      if (binding.preventDefault !== false) event.preventDefault();
      if (binding.stopPropagation) event.stopPropagation();
      const result = binding.handler(ctx);
      if (result !== false) return true;
    }
    return false;
  }

  /** cell / row 模式编辑器打开期间的按键 */
  function handleActiveEditorKeydown(event: KeyboardEvent, actions: ActiveEditorKeyActions) {
    switch (event.key) {
      case 'Escape': {
        actions.cancel();
        table.focusGrid();
        event.preventDefault();
        event.stopPropagation();
        break;
      }
      case 'Enter': {
        if (isIme(event)) return;
        // 仿 Excel：textarea 中 Alt/Shift+Enter 换行，Enter 提交
        if (isTextAreaLineBreak(event)) return;
        actions.commit();
        table.moveCurrent(1, 0);
        actions.afterMove();
        event.preventDefault();
        break;
      }
      case 'Tab': {
        actions.commit();
        table.moveSequential(event.shiftKey ? -1 : 1);
        actions.afterMove();
        event.preventDefault();
        break;
      }
      default:
        break;
    }
  }

  function openRowEditorAtCurrentOrFocusGrid() {
    const cell = table.getCurrentCellLocation();
    if (cell && table.isRowEditing(cell.row) && table.canEditCell(cell.rowIndex, cell.colIndex)) {
      table.setRowEditingCell(cell.rowIndex, cell.colIndex);
      return;
    }
    table.focusGrid();
  }

  /** 网格自身获得焦点时的 Tab / Esc 行为。 */
  function handleGlobalKey(event: KeyboardEvent): boolean {
    const mode = table.props.mode;

    if (event.key === 'Escape') {
      const cell = table.getCurrentCellLocation();
      if (mode === 'row' && cell && table.isRowEditing(cell.row)) {
        table.cancelRowEdit(cell.rowIndex);
      } else if (mode === 'table' && cell?.prop) {
        // table 模式 Escape：丢掉当前格未提交草稿再交回网格，语义与 cell/row 的「取消」一致；
        // 不先丢草稿的话，焦点离开编辑器会走 onBlur → flushDraft，等于把取消变成提交。
        table.discardDraft(cell.rowKey, cell.prop);
      }
      table.focusGrid();
      event.preventDefault();
      return true;
    }

    if (event.key === 'Tab') {
      table.moveSequential(event.shiftKey ? -1 : 1);
      if (mode === 'row' || mode === 'table') table.focusCurrentCellEditor();
      else table.focusGrid();
      event.preventDefault();
      return true;
    }

    return false;
  }

  /** 导航 / 进编 / 撤销重做按键；none 模式只保留导航 */
  function handleBuiltinNavigation(event: KeyboardEvent): boolean {
    const mode = table.props.mode;
    const ctrl = event.ctrlKey || event.metaKey;
    const cell = table.getCurrentCellLocation();

    const handled = (): true => {
      event.preventDefault();
      return true;
    };
    /** row/table 模式下编辑器随格常驻，移动高亮态后需把真实 DOM 焦点同步过去 */
    const syncFocus = () => {
      if (mode === 'row' || mode === 'table') table.focusCurrentCellEditor();
    };

    const key = event.key.toLowerCase();
    if (ctrl && !event.shiftKey && key === 'z') {
      if (!table.canUndo.value) return false;
      table.undo();
      return handled();
    }
    if (ctrl && ((event.shiftKey && key === 'z') || (!event.shiftKey && key === 'y'))) {
      if (!table.canRedo.value) return false;
      table.redo();
      return handled();
    }

    const delta = ARROW_DELTAS[event.key];
    if (delta) {
      table.moveCurrent(delta[0], delta[1]);
      syncFocus();
      return handled();
    }

    switch (event.key) {
      case 'Home':
      case 'End': {
        const end = event.key === 'End';
        if (ctrl) table.moveToTableCorner(end);
        else table.moveToRowEdge(end);
        syncFocus();
        return handled();
      }
      case 'Enter': {
        if (isIme(event) || !cell) return false;
        if (mode === 'cell' && table.canEditCell(cell.rowIndex, cell.colIndex)) {
          table.startEdit(cell.rowIndex, cell.colIndex);
        } else {
          table.moveCurrent(1, 0);
          syncFocus();
        }
        return handled();
      }
      case 'F2': {
        if (mode === 'none' || !cell) return false;
        if (mode === 'cell') {
          table.startEdit(cell.rowIndex, cell.colIndex);
        }
        return handled();
      }
      case 'Delete':
      case 'Backspace': {
        if (mode === 'none' || !cell) return false;
        if (table.canEditCell(cell.rowIndex, cell.colIndex)) {
          table.clearCell(cell.rowIndex, cell.colIndex);
        }
        return handled();
      }
      default: {
        // 可打印字符：选中即输入（cell 模式全部可编辑列）；
        // 文本/数字编辑器以该字符为草稿覆盖原值，其余编辑器仅进入编辑态
        if (
          mode === 'cell' &&
          cell &&
          isPrintableKey(event) &&
          table.canEditCell(cell.rowIndex, cell.colIndex)
        ) {
          const column = cell.node.column;
          const draft = typedCharToDraft(column, event.key);
          if (draft === undefined) {
            table.startEdit(cell.rowIndex, cell.colIndex);
          } else {
            table.startEdit(cell.rowIndex, cell.colIndex, {
              defaultValue: draft,
            });
          }
          return handled();
        }
        return false;
      }
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    const mode = table.props.mode;
    const [overrides, normals] = partition(getCustomHotkeys(), (h) => !!h.override);

    // 1. 用户 override 热键：先于任何内置行为判定，任何编辑态 / 焦点位置都生效
    if (runHotkeyBindings(overrides, event)) return;

    // 2. cell / row 模式编辑器打开中：走独立的编辑态按键流（Tab/Enter/Esc 语义不同）
    const editingLocation = table.getEditingCellLocation();
    const editingCell = editingLocation
      ? table.getCellElRef({
          rowKey: editingLocation.rowKey,
          colId: editingLocation.node.id,
        })
      : null;
    const fromActiveEditor = event.target instanceof Node && !!editingCell?.contains(event.target);
    if (mode === 'cell' && editingLocation && fromActiveEditor) {
      handleActiveEditorKeydown(event, {
        cancel: table.cancelEdit,
        commit: table.commitEdit,
        afterMove: table.focusGrid,
      });
      return;
    }
    if (mode === 'row' && editingLocation && fromActiveEditor) {
      handleActiveEditorKeydown(event, {
        cancel: () => table.cancelRowEdit(editingLocation.rowIndex),
        commit: () => table.clearRowEditingCell(true),
        afterMove: openRowEditorAtCurrentOrFocusGrid,
      });
      return;
    }

    // 3. 焦点在网格内部（非活动编辑器的常驻控件等）：只有归网格的按键继续走内置导航，
    //    其余（可打印字符 / 文本插入符移动 / IME）保留控件原生行为
    if (event.target !== event.currentTarget) {
      if (routeKey(event) === 'grid') {
        if (handleGlobalKey(event)) return;
        if (handleBuiltinNavigation(event)) return;
      }
      runHotkeyBindings(normals, event);
      return;
    }

    // 4. grid 自身的 Tab / Esc
    if (handleGlobalKey(event)) return;

    // 5. grid 自身的方向键 / 进编 / 撤销重做
    if (handleBuiltinNavigation(event)) return;

    // 6. 内置没处理时，才轮到用户普通热键
    runHotkeyBindings(normals, event);
  }

  return { handleKeydown };
}

export type UseKeyboardReturn = ReturnType<typeof useKeyboard>;
