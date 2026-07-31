<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { ElButton, ElCol, ElRow } from 'element-plus';

import type { FilterSchemaField } from './constants';
import FiltersItem from './filters-item.vue';

defineOptions({
  name: 'Filters',
  inheritAttrs: false,
});

const props = defineProps<{
  schema: FilterSchemaField[];
}>();

const emit = defineEmits<{
  reset: [];
  search: [values: Record<string, unknown>];
}>();

const SLOT_COUNT = 8;

const modelValue = defineModel<Record<string, unknown>>({
  default: () => ({}),
});

const keyMap = reactive<Record<number, string>>({});

function init() {
  for (const k of Object.keys(keyMap)) delete keyMap[Number(k)];

  const af = Object.keys(modelValue.value);
  const schema = props.schema ?? [];
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const k = af[i - 1];
    if (k && schema.some((s) => s.fieldName === k)) {
      keyMap[i] = k;
    }
  }
}

function onReset() {
  modelValue.value = {};
  emit('reset');
}

function onSearch() {
  emit('search', { ...modelValue.value });
}

onMounted(() => {
  if (Object.keys(keyMap).length === 0) {
    init();
  }
});
</script>

<template>
  <div class="filters" @keyup.enter.prevent="onSearch">
    <ElRow :gutter="24">
      <template v-for="i in SLOT_COUNT" :key="i">
        <ElCol :span="6">
          <FiltersItem
            v-bind="$attrs"
            v-model="modelValue"
            v-model:field-key="keyMap[i]"
            :index="i"
            :schema="schema"
            :key-map="keyMap"
          />
        </ElCol>
      </template>
      <ElCol :span="24">
        <div class="filters__actions">
          <div class="filters__slot">
            <slot />
          </div>
          <div class="filters__buttons">
            <ElButton @click="onReset">重置</ElButton>
            <ElButton type="primary" @click="onSearch">搜索</ElButton>
          </div>
        </div>
      </ElCol>
    </ElRow>
  </div>
</template>

<style lang="scss">
.filters {
  width: 100%;

  &__actions {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  &__slot {
    display: flex;
    flex: 1;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  &__buttons {
  }
}
</style>
