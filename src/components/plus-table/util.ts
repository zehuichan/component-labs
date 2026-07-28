import { isFunction, isNumber, isString } from 'es-toolkit';
import type { RowData, RowKey } from './table/defaults';
import type { PlusTableColumn } from './table-column/defaults';

export const SETTINGS_STORAGE_PREFIX = 'plus-table:settings:';

const NATIVE_RENDER_COLUMN_TYPES = ['selection', 'index', 'expand'] as const;

const SPECIAL_COLUMN_TYPES = [...NATIVE_RENDER_COLUMN_TYPES, 'operation'] as const;

interface ColumnTypeLike {
  type?: string;
}

export function isSpecialColumn(column: ColumnTypeLike): boolean {
  return !!column.type && (SPECIAL_COLUMN_TYPES as readonly string[]).includes(column.type);
}

export function isNativeRenderColumn(column: ColumnTypeLike): boolean {
  return !!column.type && (NATIVE_RENDER_COLUMN_TYPES as readonly string[]).includes(column.type);
}

export function assertRowKey(rowKey: unknown): asserts rowKey is RowKey {
  if ((!isString(rowKey) || rowKey.length === 0) && !isFunction(rowKey)) {
    throw new TypeError('[PlusTable] rowKey 必须是非空字段名或返回 string/number 的函数。');
  }
}

export function getRowIdentity<T extends RowData = RowData>(row: T, rowKey: RowKey<T>): string {
  assertRowKey(rowKey);
  const raw = isFunction(rowKey) ? rowKey(row) : row[rowKey];
  if (raw === undefined || raw === null || raw === '') {
    throw new TypeError('[PlusTable] rowKey 解析结果不能为空。');
  }
  if (!isString(raw) && !isNumber(raw)) {
    throw new TypeError('[PlusTable] rowKey 解析结果必须是 string 或 number。');
  }
  return String(raw);
}

export function devWarn(message: string): void {
  if ((import.meta as any)?.env?.DEV) console.warn(message);
}

export function resolveEditable<T extends RowData = RowData>(
  row: T,
  rowIndex: number,
  column: PlusTableColumn<T>,
): boolean {
  if (!column.prop) return false;
  const editable = column.editable;
  return isFunction(editable) ? !!editable({ row, rowIndex }) : !!editable;
}

const CONTROL_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  'label',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[tabindex]',
  '[role~="button"]',
  '[role~="checkbox"]',
  '[role~="combobox"]',
  '[role~="link"]',
  '[role~="listbox"]',
  '[role~="menuitem"]',
  '[role~="menuitemcheckbox"]',
  '[role~="menuitemradio"]',
  '[role~="option"]',
  '[role~="radio"]',
  '[role~="searchbox"]',
  '[role~="slider"]',
  '[role~="spinbutton"]',
  '[role~="switch"]',
  '[role~="tab"]',
  '[role~="textbox"]',
  '[role~="treeitem"]',
  '[data-ptbl-control]',
].join(', ');

const FOCUSABLE_EDITOR_SELECTOR =
  `:is(${CONTROL_SELECTOR})` +
  ':not([disabled])' +
  ':not([aria-disabled="true"])' +
  ':not([tabindex="-1"])' +
  ':not(input[type="hidden"])' +
  ':not(label)';

export function isControl(target: EventTarget | null, boundary?: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const control = target.closest(CONTROL_SELECTOR);
  if (!control) return false;
  if (boundary === undefined) return true;
  return boundary instanceof Element && control !== boundary && boundary.contains(control);
}

function isTextInput(el: HTMLElement): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

export interface FocusEditorOptions {
  preventScroll?: boolean;
  select?: 'all' | 'end';
  skipIfFocused?: boolean;
}

export function focusEditorElement(
  root: HTMLElement | null | undefined,
  options: FocusEditorOptions = {},
): boolean {
  const focused = document.activeElement;
  if (
    options.skipIfFocused &&
    focused instanceof Element &&
    root?.contains(focused) &&
    isControl(focused, root)
  ) {
    return true;
  }

  const input = root?.querySelector<HTMLElement>(FOCUSABLE_EDITOR_SELECTOR);
  if (!input) return false;
  if (options.skipIfFocused && document.activeElement === input) return true;

  input.focus({ preventScroll: options.preventScroll });
  if (options.select && isTextInput(input)) {
    try {
      if (options.select === 'end') {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      } else {
        input.select();
      }
    } catch {
      // number 等输入类型不支持 selection API
    }
  }
  return true;
}
