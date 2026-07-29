import { isProxy, watch } from 'vue';
import useStore from './index';
import { getRowIdentity, devWarn } from '../util';
import type { TableHost } from './context';
import type { RowData } from '../table/defaults';

export function createStore<T extends RowData = RowData>(host: TableHost<T>) {
  const store = useStore<T>(host);
  const props = host.props;

  function readData(): T[] {
    if (!Array.isArray(props.data)) {
      throw new TypeError('[PlusTable] data 必须是数组。');
    }
    return [...props.data];
  }

  function readSnapshot() {
    const data = readData();
    const rowKey = props.rowKey;
    return {
      data,
      rowKey,
      identities: data.map((row) => getRowIdentity(row, rowKey)),
    };
  }

  function warnNonReactiveRows(data: T[]): void {
    for (const [rowIndex, row] of data.entries()) {
      if (isProxy(row) || Object.isFrozen(row)) continue;
      const key = getRowIdentity(row, props.rowKey);
      devWarn(
        `[PlusTable] 第 ${rowIndex} 行（rowKey="${key}"）不是响应式对象：` +
          '字段编辑就地修改行对象，非响应式行可能导致单元格不自动重绘。请对 data 使用 reactive / ref。',
      );
      // 只提醒首行，避免刷屏
      break;
    }
  }

  const initial = readSnapshot().data;
  warnNonReactiveRows(initial);
  store.setData(initial);
  let dataReadFailed = false;
  watch(
    () => {
      dataReadFailed = false;
      try {
        return readSnapshot();
      } catch (error) {
        dataReadFailed = true;
        throw error;
      }
    },
    (snapshot) => {
      if (dataReadFailed) return;
      warnNonReactiveRows(snapshot.data);
      store.setData(snapshot.data);
    },
  );
  watch(
    () => props.history,
    (history) => {
      if (!history) store.clearHistory();
    },
  );
  return store;
}
