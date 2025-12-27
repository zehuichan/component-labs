<script setup>
import { ref, onMounted } from 'vue';
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
    component: 'Input',
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

const handleEditModeChange = (mode) => {
  editable.value = mode;
};

const handleValidate = async () => {
  const res = await tableRef.value.validate();
  console.log(res);
};

onMounted(() => {
  setTimeout(() => {
    loading.value = false;
    tableData.value = data;
  }, 1000);
});
</script>

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

<style lang="scss"></style>
