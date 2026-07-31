<script setup lang="ts">
import { computed } from 'vue';
import { ElInput, ElSelect } from 'element-plus';

import { useGlobalShareState, type ComponentType } from '@/adapter';

import type { FilterSchemaField } from './constants';

defineOptions({
  name: 'FiltersItem',
  inheritAttrs: false,
});

const props = defineProps<{
  index: number;
  /** 全部槽位的 fieldName，用于互斥 */
  keyMap: Record<number, string>;
  schema: FilterSchemaField[];
}>();

const fieldKey = defineModel<string | undefined>('fieldKey');

const modelValue = defineModel<Record<string, unknown>>({ required: true });

const { getComponents } = useGlobalShareState();

const effectField = computed(() => fieldKey.value);

const selectOptions = computed(() => {
  const km = props.keyMap;
  return props.schema.map(({ fieldName: value, label }) => ({
    label,
    value,
    disabled:
      Object.entries(km).some(([j, v]) => Number(j) !== props.index && v === value) &&
      value !== km[props.index],
  }));
});

const activeItem = computed(() => props.schema.find((s) => s.fieldName === fieldKey.value));

/** schema.modelPropName > Element Plus 默认 modelValue */
const activeModelPropName = computed(() => {
  const fromSchema = activeItem.value?.modelPropName;
  if (typeof fromSchema === 'string' && fromSchema) {
    return fromSchema;
  }
  return 'modelValue';
});

const valueComponent = computed(() => {
  const name = activeItem.value?.component;
  const components = getComponents();
  if (name != null && Object.hasOwn(components, name)) {
    return components[name as ComponentType] ?? ElInput;
  }
  return components.input ?? ElInput;
});

const valueComponentBinds = computed(() => {
  const field = effectField.value;
  const item = activeItem.value;
  if (!field || !item) {
    return {};
  }
  const prop = activeModelPropName.value;
  const mv = modelValue.value;
  return {
    ...(item.componentProps ?? {}),
    [prop]: mv[field],
    [`onUpdate:${prop}`]: (v: unknown) => {
      modelValue.value = { ...modelValue.value, [field]: v };
    },
  } as Record<string, unknown>;
});
</script>

<template>
  <div class="filter-item">
    <div class="filter-item__label">
      <ElSelect
        :key="`filter-select-${index}`"
        v-model="fieldKey"
        class="filter-item__label-select"
        :options="selectOptions"
        clearable
        :placeholder="`键${index}`"
      />
    </div>
    <div class="filter-item__value">
      <component
        v-if="effectField && activeItem"
        class="filter-item__value-input"
        :key="`filter-input-${index}-${effectField}`"
        :is="valueComponent"
        v-bind="valueComponentBinds"
      />
      <ElInput v-else readonly :placeholder="`值${index}`" />
    </div>
  </div>
</template>

<style lang="scss">
.filter-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;

  &__label {
    flex-shrink: 0;
    width: 120px;
    &-select {
      width: 100%;
      max-width: 100%;
    }
  }

  &__value {
    flex: 1;
    min-width: 0;

    &-input {
      width: 100%;
      max-width: 100%;

      // Element Plus 日期/时间组件会设置默认固定宽度。
      &.el-date-editor {
        width: 100%;
      }
    }
  }
}
</style>
