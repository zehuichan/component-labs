import { computed, isProxy, shallowRef } from 'vue';
import { assertRowKey, devWarn, getRowIdentity } from '../utils';
import type { PlusTableResolvedProps } from '../table';
import type { RowData, RowLocation } from '../types';

/**
 * 行数据与身份索引。data 是当前页的行数组（分页时只是切片），
 * keysMap / rowKeyMap 按 rowKey 与行对象双向寻址；换页 / 重排后仍以 rowKey 对回正确的行。
 */
export function useData<T extends RowData = RowData>(props: PlusTableResolvedProps<T>) {
  const data = shallowRef<T[]>([]);

  const rowRegistry = computed(() => {
    const keysMap = new Map<string, RowLocation<T>>();
    const rowKeyMap = new WeakMap<T, string>();
    const option = props.rowKey;
    assertRowKey(option);
    data.value.forEach((row, rowIndex) => {
      const key = getRowIdentity(row, option);
      const existing = keysMap.get(key);
      if (existing) {
        throw new Error(
          `[PlusTable] rowKey="${key}" 重复：第 ${existing.rowIndex} 行与第 ${rowIndex} 行使用了相同标识。`,
        );
      }
      keysMap.set(key, { row, rowIndex });
      rowKeyMap.set(row, key);
    });
    return { keysMap, rowKeyMap };
  });

  const keysMap = computed(() => rowRegistry.value.keysMap);
  const rowKeyMap = computed(() => rowRegistry.value.rowKeyMap);

  function getRowKey(row: T): string {
    return rowKeyMap.value.get(row) ?? getRowIdentity(row, props.rowKey);
  }

  /**
   * 读一份 props.data 快照；顺带读取每行身份，让父级就地改写 rowKey 字段也能触发重新同步。
   * 行对象不是响应式时，字段编辑就地修改后单元格不会自动重绘，开发期提醒一次。
   */
  function readDataSnapshot(): T[] {
    if (!Array.isArray(props.data)) {
      throw new TypeError('[PlusTable] data 必须是数组。');
    }
    const snapshot = [...props.data];
    const option = props.rowKey;
    const identities = snapshot.map((row) => getRowIdentity(row, option));
    const plainIndex = snapshot.findIndex((row) => !isProxy(row) && !Object.isFrozen(row));
    if (plainIndex >= 0) {
      devWarn(
        `[PlusTable] 第 ${plainIndex} 行（rowKey="${identities[plainIndex]}"）不是响应式对象：` +
          '字段编辑就地修改行对象，非响应式行可能导致单元格不自动重绘。请对 data 使用 reactive / ref。',
      );
    }
    return snapshot;
  }

  return {
    data,
    keysMap,
    rowKeyMap,
    getRowKey,
    readDataSnapshot,
  };
}

export type UseDataReturn<T extends RowData = RowData> = ReturnType<typeof useData<T>>;
