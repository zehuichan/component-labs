import { shallowRef, triggerRef } from 'vue';
import { cloneDeep, isEqual } from 'es-toolkit';
import type { TableCoreContext } from './context';
import type { RowData } from '../table/defaults';

export interface DirtyCell {
  rowKey: string;
  prop: string;
}

/**
 * 脏行/脏格追踪。以 rowKey 寻址、以 rowKey 存基线快照（不是数组下标），
 * 原因与 history 一致：插入/删除/移动行或换页都会让下标错位。
 */
export function useDirty<T extends RowData = RowData>(core: TableCoreContext<T>) {
  const states = {
    dirtyCells: shallowRef(new Map<string, Set<string>>()),
  };
  const baseline = new Map<string, T>();

  function enabled(): boolean {
    return core.states.dirtyTracking.value;
  }

  function ensureBaseline(row: T, rowKey: string): T {
    let snapshot = baseline.get(rowKey);
    if (!snapshot) {
      snapshot = cloneDeep(row);
      baseline.set(rowKey, snapshot);
    }
    return snapshot;
  }

  /** 在字段写值之前调用：行首次被写时，用其（尚未修改的）当前状态建立基线快照。 */
  function touchRow(row: T, rowKey: string): void {
    if (!enabled()) return;
    ensureBaseline(row, rowKey);
  }

  function markDirty(rowKey: string, prop: string): void {
    if (!enabled()) return;
    const row = core.states.keysMap.value.get(rowKey)?.row;
    if (!row) return;
    const snapshot = ensureBaseline(row, rowKey);
    const isDirty = !isEqual(snapshot[prop], row[prop]);
    const map = states.dirtyCells.value;
    const set = map.get(rowKey);
    if (isDirty) {
      if (set) {
        if (set.has(prop)) return;
        set.add(prop);
      } else {
        map.set(rowKey, new Set([prop]));
      }
    } else if (set?.has(prop)) {
      set.delete(prop);
      if (set.size === 0) map.delete(rowKey);
    } else {
      return;
    }
    triggerRef(states.dirtyCells);
  }

  function isCellDirty(rowKey: string, prop: string): boolean {
    return states.dirtyCells.value.get(rowKey)?.has(prop) ?? false;
  }

  function isRowDirty(rowKey: string): boolean {
    return states.dirtyCells.value.has(rowKey);
  }

  /** 返回脏格身份的只读快照，不暴露内部 Map / Set。 */
  function getDirtyCells(): DirtyCell[] {
    const result: DirtyCell[] = [];
    for (const [rowKey, props] of states.dirtyCells.value) {
      for (const prop of props) result.push({ rowKey, prop });
    }
    return result;
  }

  function getModifiedRows(): T[] {
    const map = states.dirtyCells.value;
    return core.states.data.value.filter((row: T) => map.has(core.getRowKey(row)));
  }

  function clearDirty(rowKey?: string, prop?: string): void {
    const map = states.dirtyCells.value;
    if (rowKey === undefined) {
      if (map.size === 0) return;
      states.dirtyCells.value = new Map();
      return;
    }
    if (prop === undefined) {
      if (!map.delete(rowKey)) return;
    } else {
      const set = map.get(rowKey);
      if (!set?.delete(prop)) return;
      if (set.size === 0) map.delete(rowKey);
    }
    triggerRef(states.dirtyCells);
  }

  /** 把当前 data 视为新基线：清空脏标记，重建每行的基线快照 */
  function resetTracking(): void {
    baseline.clear();
    for (const row of core.states.data.value) {
      baseline.set(core.getRowKey(row), cloneDeep(row));
    }
    states.dirtyCells.value = new Map();
  }

  /** 数据行身份失效时调用：同时丢弃该 rowKey 的基线与脏标记。 */
  function invalidateDirtyRow(rowKey: string): void {
    baseline.delete(rowKey);
    if (states.dirtyCells.value.delete(rowKey)) {
      triggerRef(states.dirtyCells);
    }
  }

  return {
    touchRow,
    markDirty,
    isCellDirty,
    isRowDirty,
    getDirtyCells,
    getModifiedRows,
    clearDirty,
    resetTracking,
    invalidateDirtyRow,
    states,
  };
}

export type DirtyApi<T extends RowData = RowData> = Omit<
  ReturnType<typeof useDirty<T>>,
  'invalidateDirtyRow'
>;
