import { computed, ref, watch } from 'vue';
import { defaultWindow } from '@vueuse/core';
import { isNumber, isPlainObject, isString, sortBy } from 'es-toolkit';
import { isSpecialColumn, SETTINGS_STORAGE_PREFIX } from '../util';
import { assertColumnDependencies } from './dependencies';
import type { TableCoreContext } from './context';
import type { RowData } from '../table/defaults';
import type { ColumnNode, PlusTableColumn } from '../table-column/defaults';

const ROOT_ID = '__root';

export interface SettingItem {
  id: string;
  parentId: string;
  title: string;
  level: number;
  isGroup: boolean;
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
}

interface PersistedSettings {
  hidden: string[];
  order: Record<string, string[]>;
  /** 列宽覆盖：数值为固定 px，null 表示强制自动宽度（压过列配置的 width） */
  widths: WidthMap;
}

type WidthMap = Record<string, number | null>;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isOrderMap(value: unknown): value is Record<string, string[]> {
  return isPlainObject(value) && Object.values(value).every(isStringArray);
}

function isWidthMap(value: unknown): value is WidthMap {
  return (
    isPlainObject(value) &&
    Object.values(value).every(
      (width) => width === null || (isNumber(width) && Number.isFinite(width) && width > 0),
    )
  );
}

function parsePersistedSettings(raw: string): PersistedSettings {
  const value: unknown = JSON.parse(raw);
  if (
    !isPlainObject(value) ||
    !isStringArray(value.hidden) ||
    !isOrderMap(value.order) ||
    !isWidthMap(value.widths)
  ) {
    throw new TypeError('[PlusTable] 列设置缓存结构无效。');
  }
  return {
    hidden: value.hidden,
    order: value.order,
    widths: value.widths,
  };
}

interface NormalizedColumns<T extends RowData> {
  tree: ColumnNode<T>[];
  byId: Map<string, ColumnNode<T>>;
  parentById: Map<string, string>;
  byProp: Map<string, ColumnNode<T>[]>;
  leafIdsById: Map<string, readonly string[]>;
  configurableLeafIdsById: Map<string, readonly string[]>;
  allDataColumns: ColumnNode<T>[];
  /** dependencies.triggerFields 反向索引：字段名 → 声明依赖了该字段的叶子数据列 */
  triggerIndex: Map<string, ColumnNode<T>[]>;
  defaultHiddenIds: Set<string>;
}

interface ColumnView<T extends RowData> {
  originColumns: ColumnNode<T>[];
  columns: ColumnNode<T>[];
  columnIndexMap: Map<string, number>;
  visibleById: Map<string, ColumnNode<T>>;
  settingItems: SettingItem[];
  settingById: Map<string, SettingItem>;
  siblingIdsByParent: Map<string, readonly string[]>;
}

function normalize<T extends RowData>(columns: PlusTableColumn<T>[]): NormalizedColumns<T> {
  const nextSuffix = new Map<string, number>();
  const usedIds = new Set([ROOT_ID]);
  const firstColumnKeyByProp = new Map<string, string | null>();
  const byId = new Map<string, ColumnNode<T>>();
  const parentById = new Map<string, string>();
  const byProp = new Map<string, ColumnNode<T>[]>();
  const leafIdsById = new Map<string, readonly string[]>();
  const configurableLeafIdsById = new Map<string, readonly string[]>();
  const allDataColumns: ColumnNode<T>[] = [];
  const triggerIndex = new Map<string, ColumnNode<T>[]>();
  const defaultHiddenIds = new Set<string>();

  const walk = (list: PlusTableColumn<T>[], path: string, parentId: string): ColumnNode<T>[] =>
    list.map((column, index) => {
      assertColumnDependencies(column);
      const explicitId =
        isString(column.columnKey) && column.columnKey.length > 0 ? column.columnKey : null;
      if (!column.children?.length && !isSpecialColumn(column) && column.prop) {
        if (
          firstColumnKeyByProp.has(column.prop) &&
          (!firstColumnKeyByProp.get(column.prop) || !explicitId)
        ) {
          throw new Error(
            `[PlusTable] duplicate prop="${column.prop}" 的列必须分别提供稳定且唯一的 columnKey。`,
          );
        }
        if (!firstColumnKeyByProp.has(column.prop)) {
          firstColumnKeyByProp.set(column.prop, explicitId);
        }
      }
      const base =
        explicitId ?? column.prop ?? column.label ?? column.type ?? `col-${path}${index}`;
      let id = explicitId;
      if (id) {
        if (usedIds.has(id)) {
          throw new Error(`[PlusTable] columnKey="${id}" 重复或与内部保留标识冲突。`);
        }
      } else {
        let suffix = nextSuffix.get(base) ?? 0;
        id = suffix === 0 ? base : `${base}#${suffix}`;
        while (usedIds.has(id)) id = `${base}#${++suffix}`;
        nextSuffix.set(base, suffix + 1);
      }
      usedIds.add(id);
      const children = column.children?.length
        ? walk(column.children, `${path}${index}-`, id)
        : undefined;
      const node = { id, column, children };
      const leafIds = children
        ? children.flatMap((child) => leafIdsById.get(child.id) ?? [])
        : [id];
      const configurableLeafIds = children
        ? children.flatMap((child) => configurableLeafIdsById.get(child.id) ?? [])
        : isSpecialColumn(column)
          ? []
          : [id];

      byId.set(id, node);
      parentById.set(id, parentId);
      leafIdsById.set(id, leafIds);
      configurableLeafIdsById.set(id, configurableLeafIds);
      if (!children && !isSpecialColumn(column)) {
        allDataColumns.push(node);
        if (column.prop) {
          const nodes = byProp.get(column.prop);
          if (nodes) nodes.push(node);
          else byProp.set(column.prop, [node]);
        }
        // 建反向索引，字段提交时不必再全列扫描找依赖方（triggerFields 已在上面断言过）
        for (const field of new Set(column.dependencies?.triggerFields ?? [])) {
          const dependents = triggerIndex.get(field);
          if (dependents) dependents.push(node);
          else triggerIndex.set(field, [node]);
        }
      }
      if (!isSpecialColumn(column) && column.visible === false) {
        for (const leafId of configurableLeafIds) {
          defaultHiddenIds.add(leafId);
        }
      }
      return node;
    });

  return {
    tree: walk(columns, '', ROOT_ID),
    byId,
    parentById,
    byProp,
    leafIdsById,
    configurableLeafIdsById,
    allDataColumns,
    triggerIndex,
    defaultHiddenIds,
  };
}

function fixedRank<T extends RowData>(column: PlusTableColumn<T>): number {
  if (column.fixed === true || column.fixed === 'left') return 0;
  if (column.fixed === 'right') return 2;
  return 1;
}

function orderSiblings<T extends RowData>(
  nodes: ColumnNode<T>[],
  parentId: string,
  orderMap: Record<string, string[]>,
): ColumnNode<T>[] {
  const order = orderMap[parentId];
  if (!order?.length) return nodes;

  const orderableIndexes: number[] = [];
  const orderable: ColumnNode<T>[] = [];
  nodes.forEach((node, index) => {
    if (!isSpecialColumn(node.column)) {
      orderableIndexes.push(index);
      orderable.push(node);
    }
  });
  const position = new Map(order.map((id, index) => [id, index]));
  const sorted = sortBy(orderable, [(node) => position.get(node.id) ?? order.length]);
  const result = [...nodes];
  orderableIndexes.forEach((originalIndex, index) => {
    result[originalIndex] = sorted[index]!;
  });
  return result;
}

function buildColumnView<T extends RowData>(
  normalized: NormalizedColumns<T>,
  hiddenIds: ReadonlySet<string>,
  orderMap: Record<string, string[]>,
): ColumnView<T> {
  const settingItems: SettingItem[] = [];
  const settingById = new Map<string, SettingItem>();
  const siblingIdsByParent = new Map<string, readonly string[]>();

  const visible = (nodes: ColumnNode<T>[], parentId: string, level: number): ColumnNode<T>[] => {
    const ordered = orderSiblings(nodes, parentId, orderMap);
    siblingIdsByParent.set(
      parentId,
      ordered.map((node) => node.id),
    );
    const result: ColumnNode<T>[] = [];

    for (const node of ordered) {
      if (!isSpecialColumn(node.column)) {
        const configurableIds = normalized.configurableLeafIdsById.get(node.id) ?? [];
        const visibleCount = configurableIds.filter((id) => !hiddenIds.has(id)).length;
        const item: SettingItem = {
          id: node.id,
          parentId,
          title: node.column.label ?? node.column.prop ?? node.id,
          level,
          isGroup: !!node.children?.length,
          checked: visibleCount === configurableIds.length,
          indeterminate: visibleCount > 0 && visibleCount < configurableIds.length,
          disabled: configurableIds.length === 0,
        };
        settingItems.push(item);
        settingById.set(item.id, item);
      }

      if (node.children?.length) {
        const children = visible(node.children, node.id, level + 1);
        if (children.length) {
          /**
           * 子树可见叶子 id 的有序指纹。分组列的重挂载 key 直接读它，渲染期不再
           * 递归 JSON.stringify；子节点自身的指纹已算好，逐层拼接即可自底向上得到
           * 整棵子树的叶子序列。
           */
          const subtreeKey = children.map((child) => child.subtreeKey ?? child.id).join('|');
          result.push({ ...node, children, subtreeKey });
        }
      } else if (isSpecialColumn(node.column) || !hiddenIds.has(node.id)) {
        result.push(node);
      }
    }
    return result;
  };

  const originColumns = sortBy(visible(normalized.tree, ROOT_ID, 0), [
    (node) => fixedRank(node.column),
  ]);
  const columns: ColumnNode<T>[] = [];
  const collectDataColumns = (nodes: ColumnNode<T>[]) => {
    for (const node of nodes) {
      if (node.children?.length) collectDataColumns(node.children);
      else if (!isSpecialColumn(node.column)) columns.push(node);
    }
  };
  collectDataColumns(originColumns);

  return {
    originColumns,
    columns,
    columnIndexMap: new Map(columns.map((node, index) => [node.id, index])),
    visibleById: new Map(columns.map((node) => [node.id, node])),
    settingItems,
    settingById,
    siblingIdsByParent,
  };
}

export function useColumns<T extends RowData = RowData>(core: TableCoreContext<T>) {
  const props = core.host.props;
  const normalized = computed<NormalizedColumns<T>>(() => {
    if (!Array.isArray(props.columns)) {
      throw new TypeError('[PlusTable] columns 必须是数组。');
    }
    return normalize(props.columns as PlusTableColumn<T>[]);
  });
  const states = {
    _columns: computed<ColumnNode<T>[]>(() => normalized.value.tree),
    hiddenIds: ref<Set<string>>(new Set()),
    orderMap: ref<Record<string, string[]>>({}),
    /** 列宽覆盖（叶子列 id → px，null 为强制自动）；缺 key 才表示回落列配置 */
    widthMap: ref<WidthMap>({}),
  };

  const storageKey = computed(() =>
    props.cache && props.id ? `${SETTINGS_STORAGE_PREFIX}${props.id}` : null,
  );

  function reportStorageError(action: '读取' | '写入' | '重置', key: string, error: unknown): void {
    console.error(`[PlusTable] 列设置缓存${action}失败（key="${key}"）。`, error);
  }

  function getSettingsStorage(): Storage {
    const storage = defaultWindow?.localStorage;
    if (!storage) throw new Error('localStorage 不可用。');
    return storage;
  }

  function createDefaultSettings(): PersistedSettings {
    return {
      hidden: [...normalized.value.defaultHiddenIds],
      order: {},
      widths: {},
    };
  }

  function snapshotSettings(): PersistedSettings {
    return {
      hidden: [...states.hiddenIds.value],
      order: states.orderMap.value,
      widths: states.widthMap.value,
    };
  }

  function sanitizeSettings(
    settings: PersistedSettings,
    model = normalized.value,
  ): PersistedSettings {
    const configurableIds = new Set(model.allDataColumns.map((column) => column.id));
    const order: Record<string, string[]> = {};
    for (const [parentId, ids] of Object.entries(settings.order)) {
      if (parentId !== ROOT_ID && !model.byId.has(parentId)) continue;
      const retained = ids.filter((id) => model.parentById.get(id) === parentId);
      if (retained.length) order[parentId] = retained;
    }
    return {
      hidden: settings.hidden.filter((id) => configurableIds.has(id)),
      order,
      widths: Object.fromEntries(
        Object.entries(settings.widths).filter(([id]) => model.byId.has(id)),
      ),
    };
  }

  function applySettings(settings: PersistedSettings): void {
    states.hiddenIds.value = new Set(settings.hidden);
    states.orderMap.value = settings.order;
    states.widthMap.value = settings.widths;
  }

  /**
   * 唯一落盘出口：settings 为 null 表示清除缓存条目。每个列设置写入点显式调用，
   * 因此「重置」与「同一 tick 内的后续改动」不再需要靠 nextTick 回读状态去猜是哪一种。
   */
  function persist(settings: PersistedSettings | null): void {
    const key = storageKey.value;
    if (!key) return;
    try {
      const storage = getSettingsStorage();
      if (settings) storage.setItem(key, JSON.stringify(settings));
      else storage.removeItem(key);
    } catch (error) {
      reportStorageError(settings ? '写入' : '重置', key, error);
    }
  }

  function loadPersisted(): PersistedSettings | null {
    const key = storageKey.value;
    if (!key) return null;
    try {
      const storage = getSettingsStorage();
      const raw = storage.getItem(key);
      if (raw === null) return null;
      return parsePersistedSettings(raw);
    } catch (error) {
      reportStorageError('读取', key, error);
      return null;
    }
  }

  watch(
    storageKey,
    () => {
      const persisted = loadPersisted();
      applySettings(sanitizeSettings(persisted ?? createDefaultSettings()));
    },
    { immediate: true },
  );

  watch(normalized, (next, previous) => {
    const settings = snapshotSettings();
    const hiddenIds = new Set(settings.hidden);
    for (const id of next.defaultHiddenIds) {
      if (!previous.byId.has(id)) hiddenIds.add(id);
    }
    settings.hidden = [...hiddenIds];
    applySettings(sanitizeSettings(settings, next));
    // 列结构变了，落盘的覆盖项也要跟着裁剪，别把已消失的列一直留在缓存里
    persist(snapshotSettings());
  });

  /**
   * 一次视图构建同时产出渲染树、可导航叶子、列下标和设置项；归一化树及其索引
   * 只在 props.columns 变化时重建。
   */
  const columnView = computed(() =>
    buildColumnView(normalized.value, states.hiddenIds.value, states.orderMap.value),
  );
  const originColumns = computed(() => columnView.value.originColumns);
  const columns = computed(() => columnView.value.columns);
  const allColumns = computed(() => normalized.value.allDataColumns);
  const triggerIndex = computed<ReadonlyMap<string, readonly ColumnNode<T>[]>>(
    () => normalized.value.triggerIndex,
  );
  const columnIndexMap = computed(() => columnView.value.columnIndexMap);
  const visibleColumnsById = computed(() => columnView.value.visibleById);
  const validationSchema = computed(() =>
    normalized.value.allDataColumns.map((node) => ({
      dependencies: {
        required: node.column.dependencies?.required,
        rules: node.column.dependencies?.rules,
      },
      id: node.id,
      prop: node.column.prop,
      required: node.column.required,
      rules: node.column.rules,
    })),
  );
  const settingItems = computed(() => columnView.value.settingItems);

  function getColumnById(id: string): ColumnNode<T> | null {
    return normalized.value.byId.get(id) ?? null;
  }

  function getColumnsByProp(prop: string): readonly ColumnNode<T>[] {
    return normalized.value.byProp.get(prop) ?? [];
  }

  function getColumnIndex(columnKey: string): number {
    return columnView.value.columnIndexMap.get(columnKey) ?? -1;
  }

  /** 列设置面板跳过 selection/index/expand/operation；组项状态复用归一化叶索引。 */
  function getSettingItem(id: string): SettingItem | undefined {
    return columnView.value.settingById.get(id);
  }

  function getSiblingIds(parentId: string): readonly string[] {
    return columnView.value.siblingIdsByParent.get(parentId) ?? [];
  }

  function toggleColumnVisible(id: string, visible: boolean) {
    const leafIds = normalized.value.configurableLeafIdsById.get(id);
    if (!leafIds?.length) return;
    const next = new Set(states.hiddenIds.value);
    for (const leafId of leafIds) {
      if (visible) next.delete(leafId);
      else next.add(leafId);
    }
    states.hiddenIds.value = next;
    persist(snapshotSettings());
  }

  /** 列设置拖拽排序：把 dragId 放到同级 targetId 的前 / 后（跨级拖拽不生效） */
  function updateColumnOrder(dragId: string, targetId: string, position: 'before' | 'after') {
    if (dragId === targetId) return;
    const drag = getSettingItem(dragId);
    const target = getSettingItem(targetId);
    if (!drag || drag.disabled || !target || drag.parentId !== target.parentId) return;
    const ids = getSiblingIds(drag.parentId).filter((id) => id !== dragId);
    const targetIndex = ids.indexOf(targetId);
    if (targetIndex < 0) return;
    const insertionIndex = targetIndex + (position === 'after' ? 1 : 0);
    ids.splice(insertionIndex, 0, dragId);
    states.orderMap.value = { ...states.orderMap.value, [drag.parentId]: ids };
    persist(snapshotSettings());
  }

  /**
   * 写入列宽覆盖（持久化）。width 传 null 表示强制自动宽度——它会压过列配置里的
   * width，这是「回落列配置」（clearColumnWidth）做不到的。
   */
  function setColumnWidth(id: string, width: number | null) {
    if (!getColumnById(id)) {
      throw new Error(`[PlusTable] setColumnWidth 失败：未知列 id="${id}"。`);
    }
    let next: number | null = null;
    if (width !== null) {
      const rounded = Math.round(width);
      if (!Number.isFinite(rounded) || rounded <= 0) {
        throw new RangeError(
          `[PlusTable] setColumnWidth 失败：width 必须是有限正数或 null，收到 ${width}。`,
        );
      }
      next = rounded;
    }
    states.widthMap.value = {
      ...states.widthMap.value,
      [id]: next,
    };
    persist(snapshotSettings());
  }

  /** 移除列宽覆盖，让列回到列配置的 width；未配置则交回 el-table 自动分配 */
  function clearColumnWidth(id: string) {
    if (!getColumnById(id)) {
      throw new Error(`[PlusTable] clearColumnWidth 失败：未知列 id="${id}"。`);
    }
    if (!(id in states.widthMap.value)) return;
    const next = { ...states.widthMap.value };
    delete next[id];
    states.widthMap.value = next;
    persist(snapshotSettings());
  }

  /**
   * 回到列的初始配置并删除缓存条目。同一 tick 内紧接着发生的正常改动会自己
   * 再落一次盘，把条目写回去——两者是各自独立的显式写入，不再互相干扰。
   */
  function resetSettings() {
    applySettings(createDefaultSettings());
    persist(null);
  }

  return {
    getColumnById,
    getColumnsByProp,
    getColumnIndex,
    settingItems,
    toggleColumnVisible,
    updateColumnOrder,
    setColumnWidth,
    clearColumnWidth,
    resetSettings,
    states: {
      ...states,
      originColumns,
      columns,
      allColumns,
      triggerIndex,
      columnIndexMap,
      visibleColumnsById,
      validationSchema,
    },
  };
}
