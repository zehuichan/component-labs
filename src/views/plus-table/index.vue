<template>
  <el-config-provider size="small">
    <div class="bg-card p-3">
      <!-- 原有的编辑按钮 -->
      <el-space wrap class="mb-3">
        <el-button @click="handleEditModeChange(true)"> 开启编辑 </el-button>
        <el-button @click="handleEditModeChange(false)"> 关闭编辑 </el-button>
        <el-button @click="handleEditModeChange('row')"> 点击行编辑 </el-button>
        <el-button @click="handleEditModeChange('cell')">
          点击单元格编辑
        </el-button>
        <el-button @click="handleEditModeChange('manual')">
          手动单元格编辑
        </el-button>
        <el-button @click="handleValidate"> 校验数据 </el-button>
        <el-button type="danger" @click="runBenchmark">
          性能测试 (1000条)
        </el-button>
        <el-button type="warning" @click="runMemoryLeakTest">
          内存泄漏测试 (10轮)
        </el-button>
        <div class="ml-2 flex flex-col text-sm text-gray-500">
          <span v-if="renderTime">渲染耗时: {{ renderTime.toFixed(2) }}ms</span>
          <span v-if="memoryInfo">
            内存变化: {{ memoryInfo.diff > 0 ? '+' : ''
            }}{{ memoryInfo.diff }}MB (当前: {{ memoryInfo.used }}MB)
          </span>
        </div>
      </el-space>

      <PlusTable
        :loading="loading"
        :columns="columns"
        :data="tableData"
        :rules="rules"
        :editable="editable"
        ref="tableRef"
      >
      </PlusTable>
    </div>
  </el-config-provider>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { PlusTable } from '@/components';

const loading = ref(true);
const tableRef = ref();
const tableData = ref([]);
const editable = ref(false);

const rules = {
  column0: [
    { min: 3, max: 5, message: 'Length should be 3 to 5', trigger: 'change' },
  ],
  // column0: [{ required: true, message: '必须填写' }],
  column1: [{ required: true, message: '必须填写', trigger: 'change' }],
  column2: [{ required: true, message: '必须填写', trigger: 'change' }],
};

const generateColumns = (length = 10, prefix = 'column', props) =>
  Array.from({ length }).map((_, columnIndex) => ({
    ...props,
    prop: `${prefix}${columnIndex}`,
    label: `Column ${columnIndex}`,
  }));

const generateData = (columns, length = 200, prefix = 'row') =>
  Array.from({ length }).map((_, rowIndex) => {
    return columns.reduce(
      (rowData, column, columnIndex) => {
        rowData[column.prop] = `Row ${rowIndex} - Col ${columnIndex}`;
        return rowData;
      },
      {
        id: `${prefix}${rowIndex}`,
        parentId: null,
      },
    );
  });

const columns = [
  { type: 'selection' },
  { type: 'index', label: '序号' },
].concat(generateColumns(5));
const data = generateData(columns, 5);

// 带性能监控的编辑模式切换
const handleEditModeChange = (mode) => {
  editable.value = mode;
};

// 带性能监控的数据校验
const handleValidate = async () => {
  const res = await tableRef.value.validate();
  console.log(res);
};

const renderTime = ref(0);
const memoryInfo = ref(null);

const getMemoryUsage = () => {
  if (performance.memory) {
    return {
      used: performance.memory.usedJSHeapSize / 1024 / 1024,
      total: performance.memory.totalJSHeapSize / 1024 / 1024,
    };
  }
  return null;
};

const runBenchmark = async () => {
  loading.value = true;
  tableData.value = [];
  memoryInfo.value = null;
  await nextTick(); // Clear DOM

  // Force GC if available (usually only in Chrome with --js-flags="--expose-gc")
  if (window.gc) window.gc();

  const startMem = getMemoryUsage();

  // Generate 1000 rows for testing
  const largeData = generateData(columns, 1000);

  // Start timing
  const start = performance.now();
  tableData.value = largeData;
  loading.value = false;

  await nextTick(); // Wait for DOM update
  renderTime.value = performance.now() - start;

  const endMem = getMemoryUsage();
  if (startMem && endMem) {
    memoryInfo.value = {
      diff: (endMem.used - startMem.used).toFixed(2),
      used: endMem.used.toFixed(2),
    };
  }
};

const runMemoryLeakTest = async () => {
  loading.value = true;
  const iterations = 10;
  const initialMem = getMemoryUsage();

  console.log('Starting Memory Leak Test...');

  for (let i = 0; i < iterations; i++) {
    tableData.value = generateData(columns, 1000);
    await nextTick();
    tableData.value = [];
    await nextTick();
    if (window.gc) window.gc();
  }

  const finalMem = getMemoryUsage();
  loading.value = false;

  if (initialMem && finalMem) {
    const diff = finalMem.used - initialMem.used;
    memoryInfo.value = {
      diff: diff.toFixed(2),
      used: finalMem.used.toFixed(2),
    };
    console.log(
      `Memory Leak Test Result: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}MB`,
    );
    if (diff > 5) {
      console.warn('Possible memory leak detected!');
    }
  }
};

onMounted(() => {
  setTimeout(() => {
    loading.value = false;
    tableData.value = data;
  }, 1000);
});
</script>

<style lang="scss"></style>
