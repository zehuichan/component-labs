<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ name: 'ManualFieldTags' });

const props = defineProps<{
  row: object;
  /** Row fields that carry a `default` rule. */
  fields: readonly string[];
  labels?: Record<string, string>;
  isManual: (target: [row: object, field: string]) => boolean;
}>();

const emit = defineEmits<{
  restore: [field: string];
}>();

const manualFields = computed(() =>
  props.fields.filter((field) => props.isManual([props.row, field])),
);
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <template v-if="manualFields.length">
      <el-tag
        v-for="field in manualFields"
        :key="field"
        size="small"
        type="warning"
        closable
        title="点 × 恢复规则值"
        @close="emit('restore', field)"
      >
        {{ labels?.[field] ?? field }}
      </el-tag>
    </template>
    <span v-else class="text-xs text-[var(--el-text-color-placeholder)]">跟随规则</span>
  </div>
</template>
