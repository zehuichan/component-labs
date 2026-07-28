import { createApp, h, nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import PlusTableCell from '../../table-cell';
import { PLUS_TABLE_INJECTION_KEY } from '../../tokens';
import { createTestTable, type TestTable } from '../helpers/create-test-table';
import type { ColumnNode } from '../../table-column/defaults';

interface Row {
  id: number;
  name: string;
}

const ERROR_MESSAGE = '名称不能为空';

function popper(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="tooltip"]');
}

/** 让 Vue 的过渡与 popper 的定时器跑完，隐藏后的浮层才会真正卸载 */
function flushTransitions(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 80));
}

describe('PlusTable cell error tooltip', () => {
  const tables: TestTable<Row>[] = [];
  const mounted: Array<{ app: ReturnType<typeof createApp>; host: HTMLElement }> = [];

  async function setup() {
    const testTable = createTestTable<Row>({
      data: [{ id: 1, name: '' }],
      columns: [{ prop: 'name', label: '名称', required: true }],
      mode: 'none',
    });
    tables.push(testTable);
    await testTable.store.validate(false);

    const row = testTable.store.states.data.value[0]!;
    // PlusTableCell 的 props 按 RowData 声明（列节点由 el-table 的 slot 透传，泛型在那里已被擦除）
    const node = testTable.store.states.columns.value[0]! as unknown as ColumnNode;
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({
      render: () => h(PlusTableCell, { row, rowIndex: 0, node }),
    });
    app.provide(PLUS_TABLE_INJECTION_KEY, testTable.table);
    app.mount(host);
    await nextTick();
    mounted.push({ app, host });

    return { host, trigger: host.querySelector<HTMLElement>('.ptbl-cell-tooltip-trigger')! };
  }

  afterEach(async () => {
    for (const { app, host } of mounted.splice(0)) {
      app.unmount();
      host.remove();
    }
    for (const table of tables.splice(0)) table.dispose();
    await flushTransitions();
  });

  it('describes the error without mounting a tooltip up front', async () => {
    const { host, trigger } = await setup();

    expect(trigger).toBeTruthy();
    const cell = trigger.querySelector<HTMLElement>('.ptbl-cell')!;
    expect(cell.getAttribute('aria-invalid')).toBe('true');
    const describedBy = cell.getAttribute('aria-describedby')!;
    expect(host.querySelector(`#${CSS.escape(describedBy)}`)?.textContent).toBe(ERROR_MESSAGE);
    // 未交互前不挂载 ElTooltip：整表报错时能省下成百上千个 popper 实例
    expect(popper()).toBeNull();
  });

  it('mounts and opens the tooltip on the first hover', async () => {
    const { trigger } = await setup();

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    await nextTick();

    expect(popper()?.textContent).toContain(ERROR_MESSAGE);

    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    await flushTransitions();

    expect(popper()).toBeNull();
  });

  it('mounts and opens the tooltip when the cell takes focus', async () => {
    const { trigger } = await setup();

    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await nextTick();
    await nextTick();

    expect(popper()?.textContent).toContain(ERROR_MESSAGE);

    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await flushTransitions();

    expect(popper()).toBeNull();
  });
});
