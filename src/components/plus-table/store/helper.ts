import { watch } from 'vue';
import useStore from './index';
import { getRowIdentity } from '../util';
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

  store.setData(readSnapshot().data);
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
