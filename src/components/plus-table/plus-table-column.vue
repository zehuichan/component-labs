<template>
  <el-table-column v-for="(column, index) in columns" v-bind="column">
    <template #header="scope">
      <slot :name="`header-${column.prop}`" v-bind="scope" />
    </template>
    <template #default="scope">
      <el-form
        v-if="hasEditable(scope.$index, index, column)"
        :model="scope.row"
        :rules="rules"
        :ref="(instance) => changeInstance(instance, scope.$index, index, column)"
        :show-message="false"
      >
        <el-form-item :prop="column.prop">
          <slot
            :name="`editor-${column.prop}`"
            v-bind="scope || {}"
          />
        </el-form-item>
      </el-form>
      <slot
        v-if="$slots[column.prop]"
        :name="column.prop"
        v-bind="scope || {}"
      />
    </template>
  </el-table-column>
</template>

<script setup>
import { inject } from 'vue'

import { set } from 'es-toolkit/compat'

import { isString } from '@/utils'

import { IGNORE_COLUMN_FLAG, PLUS_TABLE_INJECTION_KEY, PLUS_TABLE_FORM_INJECTION_KEY } from './tokens'

const props = defineProps({
  columns: {
    type: Array,
    default: () => [],
  },
  rules: {
    type: Object,
  },
  editable: {
    type: [Boolean, String, Object],
    default: false,
  },
})

const tableRef = inject(PLUS_TABLE_INJECTION_KEY, null)
const formRefs = inject(PLUS_TABLE_FORM_INJECTION_KEY, null)

/**
 * @description 需求1：忽略 selection、index 等特殊列
 * @description 需求2：props.editable = true 时，表格整体可编辑
 * @description 需求3：props.editable = 'row' 时，行编辑
 * @description 需求5：props.editable = 'cell' 时，单元格编辑
 * @description 需求6：props.editable = 'manual' 时，手动单元格编辑
 */
const hasEditable = (rowIndex, columnIndex, column) => {
  if (IGNORE_COLUMN_FLAG.includes(column.type)) {
    return false
  }

  const cellMeta = tableRef.cellMeta

  if (column.editable === true) {
    return true
  }
  if (column.editable === false) {
    return false
  }

  if (props.editable === true) {
    return true
  }

  if (isString(props.editable)) {
    if (props.editable === 'row') {
      return cellMeta.row === rowIndex && cellMeta.editable
    }
    if (props.editable === 'cell' || props.editable === 'manual') {
      return (
        cellMeta.row === rowIndex &&
        cellMeta.col === columnIndex &&
        cellMeta.editable
      )
    }
  }

  return false
}

const changeInstance = (instance, rowIndex, columnIndex, column) => {
  const rules = props.rules
  const field = column.prop
  if (field && rules[field]) {
    set(formRefs.value, [rowIndex, columnIndex], instance)
  }
}
</script>

<style lang="scss"></style>
