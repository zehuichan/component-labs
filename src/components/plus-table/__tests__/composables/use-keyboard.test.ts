import { nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { useKeyboard } from '../../composables/use-keyboard';
import { createTestTable, type TestTable } from '../helpers/create-test-table';
import type { HotkeyBinding } from '../../table';
import type { EditMode } from '../../types';

interface Row {
  id: number;
  name: string;
  amount: number | null;
}

const columns = [
  { prop: 'name', label: '名称', editable: true },
  { prop: 'amount', label: '金额', editable: true },
];

describe('PlusTable keyboard routing', () => {
  const tables: TestTable<Row>[] = [];
  const hosts: HTMLElement[] = [];

  /**
   * 造一个最小可用的网格 DOM：外层 tabindex 容器 + 每格一个常驻文本编辑器，
   * 再挂一个操作列风格的按钮，用来区分「有文本插入符的控件」与「有原生 Enter 语义的控件」。
   */
  function setup(mode: EditMode, options: { hotkeys?: HotkeyBinding<Row>[] } = {}) {
    const data: Row[] = [
      { id: 1, name: 'one', amount: 10 },
      { id: 2, name: 'two', amount: 20 },
      { id: 3, name: 'three', amount: 30 },
    ];
    const testTable = createTestTable<Row>({
      data,
      columns,
      mode,
      history: true,
      hotkeys: options.hotkeys,
    });
    tables.push(testTable);
    const { table } = testTable;

    const grid = document.createElement('div');
    grid.setAttribute('tabindex', '0');
    document.body.append(grid);
    hosts.push(grid);

    const editors = new Map<string, HTMLInputElement>();
    for (const row of data) {
      for (const node of table.columns.value) {
        const cell = document.createElement('div');
        cell.id = testTable.table.ids.cell(String(row.id), node.id);
        const editor = document.createElement('input');
        editor.type = 'text';
        cell.append(editor);
        grid.append(cell);
        editors.set(`${row.id}:${node.id}`, editor);
      }
    }
    const actionButton = document.createElement('button');
    grid.append(actionButton);

    testTable.table.gridRef.value = grid;
    const keyboard = useKeyboard(testTable.table);
    grid.addEventListener('keydown', keyboard.handleKeydown);

    function editorAt(rowIndex: number, colIndex: number): HTMLInputElement {
      const rowKey = String(data[rowIndex]!.id);
      const colId = table.columns.value[colIndex]!.id;
      return editors.get(`${rowKey}:${colId}`)!;
    }

    function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}) {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      target.dispatchEvent(event);
      return event;
    }

    return {
      table,
      rows: table.data.value,
      grid,
      actionButton,
      editorAt,
      press,
      current: () => table.currentCell.value,
    };
  }

  afterEach(() => {
    for (const testTable of tables.splice(0)) testTable.dispose();
    for (const host of hosts.splice(0)) host.remove();
  });

  describe('none mode', () => {
    it('navigates without ever entering an editor', () => {
      const { table, rows, grid, press, current } = setup('none');
      table.setCurrentCell(0, 0, false);

      expect(press(grid, 'ArrowDown').defaultPrevented).toBe(true);
      expect(current()).toEqual({ rowIndex: 1, colIndex: 0 });
      expect(press(grid, 'Enter').defaultPrevented).toBe(true);
      expect(current()).toEqual({ rowIndex: 2, colIndex: 0 });

      expect(press(grid, 'F2').defaultPrevented).toBe(false);
      expect(press(grid, 'x').defaultPrevented).toBe(false);
      expect(press(grid, 'Delete').defaultPrevented).toBe(false);
      expect(table.isCellEditing(2, 0)).toBe(false);
      expect(rows[2]!.name).toBe('three');
    });
  });

  describe('cell mode', () => {
    it('starts an edit from F2 and seeds a printable character as the draft', () => {
      const { table, grid, press } = setup('cell');
      table.setCurrentCell(0, 0, false);

      expect(press(grid, 'F2').defaultPrevented).toBe(true);
      expect(table.isCellEditing(0, 0)).toBe(true);
      table.cancelEdit();

      expect(press(grid, 'x').defaultPrevented).toBe(true);
      expect(table.isCellEditing(0, 0)).toBe(true);
      expect(table.getDraft('1', 'name').value).toBe('x');
    });

    it('clears the current cell with Delete from the grid', () => {
      const { table, rows, grid, press } = setup('cell');
      table.setCurrentCell(0, 1, false);

      expect(press(grid, 'Delete').defaultPrevented).toBe(true);
      expect(rows[0]!.amount).toBeNull();
    });

    it('keeps arrow keys local inside the active editor and cancels on Escape', () => {
      const { table, editorAt, press, current } = setup('cell');
      table.setCurrentCell(0, 0, false);
      expect(table.startEdit(0, 0)).toBe(true);
      const editor = editorAt(0, 0);

      expect(press(editor, 'ArrowDown').defaultPrevented).toBe(false);
      expect(current()).toEqual({ rowIndex: 0, colIndex: 0 });

      expect(press(editor, 'Escape').defaultPrevented).toBe(true);
      expect(table.isCellEditing(0, 0)).toBe(false);
    });

    it('commits the active editor and moves down on Enter', () => {
      const { table, rows, editorAt, press, current } = setup('cell');
      table.setCurrentCell(0, 0, false);
      expect(table.startEdit(0, 0)).toBe(true);
      table.setDraft('1', 'name', 'edited');

      expect(press(editorAt(0, 0), 'Enter').defaultPrevented).toBe(true);
      expect(rows[0]!.name).toBe('edited');
      expect(current()).toEqual({ rowIndex: 1, colIndex: 0 });
    });
  });

  describe('row mode', () => {
    it('crosses cells from a non-active editor in the editing row', () => {
      const { table, editorAt, press, current } = setup('row');
      table.setCurrentCell(0, 0, false);
      expect(table.startRowEdit(0)).toBe(true);
      const sibling = editorAt(0, 1);

      expect(press(sibling, 'ArrowDown').defaultPrevented).toBe(true);
      expect(current()).toEqual({ rowIndex: 1, colIndex: 0 });

      table.setCurrentCell(0, 0, false);
      expect(press(sibling, 'Tab').defaultPrevented).toBe(true);
      expect(current()).toEqual({ rowIndex: 0, colIndex: 1 });
    });

    it('cancels the whole row on Escape from a non-active editor', () => {
      const { table, editorAt, press } = setup('row');
      table.setCurrentCell(0, 0, false);
      expect(table.startRowEdit(0)).toBe(true);

      expect(press(editorAt(0, 1), 'Escape').defaultPrevented).toBe(true);
      expect(table.editingRowKey.value).toBeNull();
    });

    it('cancels the whole row on Escape from the active editor', () => {
      const { table, editorAt, press } = setup('row');
      table.setCurrentCell(0, 0, false);
      expect(table.startRowEdit(0)).toBe(true);
      expect(table.setRowEditingCell(0, 0)).toBe(true);

      expect(press(editorAt(0, 0), 'Escape').defaultPrevented).toBe(true);
      expect(table.editingRowKey.value).toBeNull();
    });
  });

  describe('table mode', () => {
    it('navigates the grid while focus stays inside a resident editor', async () => {
      const { table, editorAt, press, current } = setup('table');
      table.setCurrentCell(0, 0, false);

      expect(press(editorAt(0, 0), 'ArrowDown').defaultPrevented).toBe(true);
      expect(current()).toEqual({ rowIndex: 1, colIndex: 0 });
      await nextTick();
      expect(document.activeElement).toBe(editorAt(1, 0));

      expect(press(editorAt(1, 0), 'Tab').defaultPrevented).toBe(true);
      expect(current()).toEqual({ rowIndex: 1, colIndex: 1 });
    });

    it('leaves the text caret to the editor but keeps Ctrl combos on the grid', () => {
      const { table, editorAt, press, current } = setup('table');
      table.setCurrentCell(0, 1, false);
      const editor = editorAt(0, 1);

      expect(press(editor, 'ArrowLeft').defaultPrevented).toBe(false);
      expect(press(editor, 'Home').defaultPrevented).toBe(false);
      expect(press(editor, 'a').defaultPrevented).toBe(false);
      expect(current()).toEqual({ rowIndex: 0, colIndex: 1 });

      expect(press(editor, 'ArrowLeft', { ctrlKey: true }).defaultPrevented).toBe(true);
      expect(current()).toEqual({ rowIndex: 0, colIndex: 0 });
    });

    it('owns undo from inside an editor', () => {
      const { table, rows, editorAt, press } = setup('table');
      table.setCurrentCell(0, 0, false);
      table.setCellValue(rows[0]!, 0, 'name', 'changed');

      expect(press(editorAt(0, 0), 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
      expect(rows[0]!.name).toBe('one');
    });

    it('moves down on Enter and refocuses the editor of the new cell', async () => {
      const { table, editorAt, press, current } = setup('table');
      table.setCurrentCell(0, 0, false);

      expect(press(editorAt(0, 0), 'Enter').defaultPrevented).toBe(true);
      expect(current()).toEqual({ rowIndex: 1, colIndex: 0 });
      await nextTick();
      expect(document.activeElement).toBe(editorAt(1, 0));
    });
  });

  describe('control-aware routing', () => {
    it('routes Delete by whether the focused control owns a text caret', () => {
      const { table, rows, editorAt, actionButton, press } = setup('table');
      table.setCurrentCell(0, 0, false);

      expect(press(editorAt(0, 0), 'Delete').defaultPrevented).toBe(false);
      expect(press(editorAt(0, 0), 'Backspace').defaultPrevented).toBe(false);
      expect(rows[0]!.name).toBe('one');

      expect(press(actionButton, 'Delete').defaultPrevented).toBe(true);
      expect(rows[0]!.name).toBeNull();
    });

    it('leaves Enter to controls that activate natively', () => {
      const { table, actionButton, press, current } = setup('table');
      table.setCurrentCell(0, 0, false);

      expect(press(actionButton, 'Enter').defaultPrevented).toBe(false);
      expect(current()).toEqual({ rowIndex: 0, colIndex: 0 });
    });
  });

  describe('custom hotkeys', () => {
    it('runs override hotkeys before grid navigation and normal hotkeys after', () => {
      const calls: string[] = [];
      const { table, editorAt, press, current } = setup('table', {
        hotkeys: [
          { key: 'ArrowDown', override: true, handler: () => void calls.push('override') },
          { key: 'Ctrl+S', handler: () => void calls.push('save') },
        ],
      });
      table.setCurrentCell(0, 0, false);
      const editor = editorAt(0, 0);

      press(editor, 'ArrowDown');
      expect(calls).toEqual(['override']);
      expect(current()).toEqual({ rowIndex: 0, colIndex: 0 });

      press(editor, 's', { ctrlKey: true });
      expect(calls).toEqual(['override', 'save']);
    });
  });
});
