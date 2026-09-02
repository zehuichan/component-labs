import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEvents } from '../../composables/use-events';
import { createTestTable, type TestTable } from '../helpers/create-test-table';
import type { ContextMenuItem } from '../../table';
import type { ResolvedMenuItem } from '../../context-menu';

interface Row {
  id: number;
  name: string;
  amount: number | null;
}

const columns = [
  { prop: 'name', label: '名称', editable: true },
  { prop: 'amount', label: '金额', editable: true },
];

describe('PlusTable context menu events', () => {
  const tables: TestTable<Row>[] = [];

  afterEach(() => {
    for (const testTable of tables.splice(0)) testTable.dispose();
  });

  function setup(options: { contextMenu?: ContextMenuItem<Row>[] } = {}) {
    const data: Row[] = [
      { id: 1, name: 'one', amount: 10 },
      { id: 2, name: 'two', amount: 20 },
    ];
    const testTable = createTestTable<Row>({
      data,
      columns,
      contextMenu: options.contextMenu,
    });
    tables.push(testTable);

    const open = vi.fn((event: MouseEvent, items: ResolvedMenuItem[]) => {
      if (!items.length) return;
      event.preventDefault();
    });
    testTable.table.contextMenuRef.value = { open };
    testTable.table.columnSettingsRef.value = { open: vi.fn() };

    const events = useEvents(testTable.table);
    return { testTable, events, open };
  }

  function mouseEvent(target: EventTarget = document.body) {
    return new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 50,
    });
  }

  it('opens header menu with hide and settings items', () => {
    const { testTable, events, open } = setup();
    const columnId = testTable.table.columns.value[0]!.id;
    const event = mouseEvent();

    events.handleHeaderContextmenu({ columnKey: columnId }, event);

    expect(event.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    const items = open.mock.calls[0]![1];
    expect(items.map((item) => item.key)).toEqual(['hide', 'settings']);
  });

  it('opens cell menu when contextMenu resolves items and sets current cell', () => {
    const handler = vi.fn();
    const { testTable, events, open } = setup({
      contextMenu: [
        {
          key: 'copy',
          label: '复制',
          handler,
        },
      ],
    });
    const row = testTable.props.data[0]!;
    const columnId = testTable.table.columns.value[1]!.id;
    const cell = document.createElement('td');
    const event = mouseEvent(cell);

    events.handleCellContextmenu(row, { columnKey: columnId }, cell, event);

    expect(event.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]![1].map((item) => item.key)).toEqual(['copy']);
    expect(testTable.table.currentCell.value).toEqual({ rowIndex: 0, colIndex: 1 });
  });

  it('does not preventDefault when contextMenu is empty', () => {
    const { testTable, events, open } = setup();
    const row = testTable.props.data[0]!;
    const columnId = testTable.table.columns.value[0]!.id;
    const cell = document.createElement('td');
    const event = mouseEvent(cell);

    events.handleCellContextmenu(row, { columnKey: columnId }, cell, event);

    expect(event.defaultPrevented).toBe(false);
    expect(open).toHaveBeenCalledWith(event, []);
  });

  it('skips items whose when() returns false', () => {
    const { testTable, events, open } = setup({
      contextMenu: [
        {
          key: 'visible',
          label: '可见',
          handler: () => undefined,
        },
        {
          key: 'hidden',
          label: '隐藏',
          when: () => false,
          handler: () => undefined,
        },
      ],
    });
    const row = testTable.props.data[0]!;
    const columnId = testTable.table.columns.value[0]!.id;
    const cell = document.createElement('td');
    const event = mouseEvent(cell);

    events.handleCellContextmenu(row, { columnKey: columnId }, cell, event);

    expect(open.mock.calls[0]![1].map((item) => item.key)).toEqual(['visible']);
  });

  it('resolves closeOnSelect and slotProps for menu item slots', () => {
    const { testTable, events, open } = setup({
      contextMenu: [
        {
          key: 'insert-n',
          label: '插入行',
          closeOnSelect: false,
          handler: () => undefined,
        },
      ],
    });
    const row = testTable.props.data[0]!;
    const columnId = testTable.table.columns.value[0]!.id;
    const cell = document.createElement('td');
    const event = mouseEvent(cell);

    events.handleCellContextmenu(row, { columnKey: columnId }, cell, event);

    const item = open.mock.calls[0]![1][0]!;
    expect(item.key).toBe('insert-n');
    expect(item.closeOnSelect).toBe(false);
    expect(item.slotProps).toEqual(
      expect.objectContaining({
        row,
        rowIndex: 0,
      }),
    );
  });

  it('does not open cell menu when right-clicking inside a control', () => {
    const { testTable, events, open } = setup({
      contextMenu: [{ key: 'copy', label: '复制', handler: () => undefined }],
    });
    const row = testTable.props.data[0]!;
    const columnId = testTable.table.columns.value[0]!.id;
    const cell = document.createElement('td');
    const input = document.createElement('input');
    cell.append(input);
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 20,
    });
    Object.defineProperty(event, 'target', { value: input });

    events.handleCellContextmenu(row, { columnKey: columnId }, cell, event);

    expect(open).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
