import { createApp, h, nextTick, ref, shallowRef, type Ref, type Slots } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLUS_TABLE_INJECTION_KEY } from '../../tokens';
import type { PlusTableContext } from '../../tokens';
import type { ColumnNode } from '../../types';

const renderedProps = vi.hoisted(() => [] as Record<string, unknown>[]);
/** 每个 el-table-column 实例挂载时的 vnode key，用来观察分组列何时被重挂载 */
const mountedKeys = vi.hoisted(() => [] as unknown[]);

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>();
  const { defineComponent, getCurrentInstance, h } = await import('vue');
  return {
    ...actual,
    ElTableColumn: defineComponent({
      inheritAttrs: false,
      setup(_, { attrs, slots }) {
        mountedKeys.push(getCurrentInstance()!.vnode.key);
        return () => {
          renderedProps.push({ ...attrs });
          // 与 el-table-column 一致：default slot 始终带 scope，$index<0 表示非数据行渲染
          return h('div', slots.default?.({ row: {}, column: {}, $index: -1 }));
        };
      },
    }),
  };
});

import PlusTableColumnNode from '../../components/column';

function leaf(id: string): ColumnNode {
  return { id, column: { prop: id, label: id.toUpperCase() } };
}

/** 分组视图节点，subtreeKey 由 buildColumnView 预先算好，这里直接模拟它的产物 */
function group(id: string, children: ColumnNode[]): ColumnNode {
  return {
    id,
    column: { label: id.toUpperCase() },
    children,
    subtreeKey: children.map((child) => child.subtreeKey ?? child.id).join('|'),
  };
}

describe('PlusTable column rendering', () => {
  const mounted: Array<{ app: ReturnType<typeof createApp>; host: Element }> = [];

  function mountNode(
    node: Ref<ColumnNode>,
    states: {
      widthMap?: Ref<Record<string, number | null>>;
      originColumns?: Ref<ColumnNode[]>;
    } = {},
  ) {
    const host = document.createElement('div');
    document.body.append(host);
    const table = {
      slots: {} as Slots,
      widthMap: states.widthMap ?? ref({}),
      originColumns: states.originColumns ?? shallowRef([node.value]),
    } as unknown as PlusTableContext;
    const app = createApp({
      render: () => h(PlusTableColumnNode, { node: node.value }),
    });
    app.provide(PLUS_TABLE_INJECTION_KEY, table);
    app.mount(host);
    mounted.push({ app, host });
    return table;
  }

  afterEach(() => {
    renderedProps.length = 0;
    mountedKeys.length = 0;
    for (const { app, host } of mounted.splice(0)) {
      app.unmount();
      host.remove();
    }
  });

  it('keeps normalized column identity and cached width authoritative', async () => {
    const node = shallowRef<ColumnNode>({
      id: '#',
      column: {
        type: 'index',
        label: '#',
        columnKey: 'caller-key',
        width: 60,
      },
    });
    mountNode(node, { widthMap: ref({ '#': 88 }) });
    await nextTick();

    expect(renderedProps.at(-1)).toEqual(expect.objectContaining({ columnKey: '#', width: 88 }));
  });

  it('drops the configured width when the override forces auto', async () => {
    const node = shallowRef<ColumnNode>({
      id: '#',
      column: { type: 'index', label: '#', width: 60 },
    });
    mountNode(node, { widthMap: ref({ '#': null }) });
    await nextTick();

    expect(renderedProps.at(-1)).toEqual(expect.objectContaining({ width: undefined }));
  });

  it('keys a group by its precomputed subtree fingerprint', async () => {
    const node = shallowRef(group('g', [leaf('a'), leaf('b')]));
    mountNode(node);
    await nextTick();

    expect(mountedKeys).toEqual(['0:g:a|b', '0:a', '1:b']);
    expect(renderedProps.map((props) => props.columnKey)).toEqual(['g', 'a', 'b']);
  });

  it('remounts the group when the visible subtree changes', async () => {
    const node = shallowRef(group('g', [leaf('a'), leaf('b')]));
    const originColumns = shallowRef<ColumnNode[]>([node.value]);
    mountNode(node, { originColumns });
    await nextTick();
    renderedProps.length = 0;
    mountedKeys.length = 0;

    // 隐藏 b：列视图重建出新的分组节点，指纹随之改变
    node.value = group('g', [leaf('a')]);
    originColumns.value = [node.value];
    await nextTick();

    expect(mountedKeys).toEqual(['0:g:a', '0:a']);
    expect(renderedProps.map((props) => props.columnKey)).toEqual(['g', 'a']);
  });

  it('re-renders group children when the column view is rebuilt', async () => {
    const node = shallowRef(group('g', [leaf('a'), leaf('b')]));
    const originColumns = shallowRef<ColumnNode[]>([node.value]);
    mountNode(node, { originColumns });
    await nextTick();
    const renderCount = renderedProps.length;

    // 只推进列视图：分组 slot 订阅了它，因此不必依赖闭包里的 children 数组也会重跑
    originColumns.value = [...originColumns.value];
    await nextTick();

    expect(renderedProps.length).toBeGreaterThan(renderCount);
    expect(mountedKeys).toEqual(['0:g:a|b', '0:a', '1:b']);
  });
});
