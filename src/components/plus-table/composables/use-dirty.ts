import { shallowRef, triggerRef } from 'vue';
import { cloneDeep, isEqual } from 'es-toolkit';
import type { PlusTableResolvedProps } from '../table';
import type { RowData } from '../types';
import type { UseDataReturn } from './use-data';

export interface DirtyCell {
  rowKey: string;
  prop: string;
}

type UseDirtyProps<T extends RowData> = Pick<UseDataReturn<T>, 'data' | 'keysMap' | 'getRowKey'>;

/**
 * 脏行/脏格追踪。以 rowKey 寻址、以 rowKey 存基线快照（不是数组下标），
 * 原因与 history 一致：插入/删除/移动行或换页都会让下标错位。
 */
export function useDirty<T extends RowData = RowData>(
  props: PlusTableResolvedProps<T>,
  { data, keysMap, getRowKey }: UseDirtyProps<T>,
) {
  const dirtyCells = shallowRef(new Map<string, Set<string>>());
  const baseline = new Map<string, T>();

  function enabled(): boolean {
    return props.dirtyTracking;
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
    const row = keysMap.value.get(rowKey)?.row;
    if (!row) return;
    const snapshot = ensureBaseline(row, rowKey);
    const isDirty = !isEqual(snapshot[prop], row[prop]);
    const map = dirtyCells.value;
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
    triggerRef(dirtyCells);
  }

  function isCellDirty(rowKey: string, prop: string): boolean {
    return dirtyCells.value.get(rowKey)?.has(prop) ?? false;
  }

  function isRowDirty(rowKey: string): boolean {
    return dirtyCells.value.has(rowKey);
  }

  /** 返回脏格身份的只读快照，不暴露内部 Map / Set。 */
  function getDirtyCells(): DirtyCell[] {
    const result: DirtyCell[] = [];
    for (const [rowKey, props] of dirtyCells.value) {
      for (const prop of props) result.push({ rowKey, prop });
    }
    return result;
  }

  function getModifiedRows(): T[] {
    const map = dirtyCells.value;
    return data.value.filter((row: T) => map.has(getRowKey(row)));
  }

  function clearDirty(rowKey?: string, prop?: string): void {
    const map = dirtyCells.value;
    if (rowKey === undefined) {
      if (map.size === 0) return;
      dirtyCells.value = new Map();
      return;
    }
    if (prop === undefined) {
      if (!map.delete(rowKey)) return;
    } else {
      const set = map.get(rowKey);
      if (!set?.delete(prop)) return;
      if (set.size === 0) map.delete(rowKey);
    }
    triggerRef(dirtyCells);
  }

  /** 把当前 data 视为新基线：清空脏标记，重建每行的基线快照 */
  function resetTracking(): void {
    baseline.clear();
    for (const row of data.value) {
      baseline.set(getRowKey(row), cloneDeep(row));
    }
    dirtyCells.value = new Map();
  }

  /** 数据行身份失效时调用：同时丢弃该 rowKey 的基线与脏标记。 */
  function invalidateDirtyRow(rowKey: string): void {
    baseline.delete(rowKey);
    if (dirtyCells.value.delete(rowKey)) {
      triggerRef(dirtyCells);
    }
  }

  return {
    dirtyCells,

    touchRow,
    markDirty,
    isCellDirty,
    isRowDirty,
    getDirtyCells,
    getModifiedRows,
    clearDirty,
    resetTracking,
    invalidateDirtyRow,
  };
}

export type UseDirtyReturn<T extends RowData = RowData> = ReturnType<typeof useDirty<T>>;
