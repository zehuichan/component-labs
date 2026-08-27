<script setup lang="ts">
import { ElMessageBox } from 'element-plus';
import { ref } from 'vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import { PlusTable } from '@/components/plus-table';
import type { CellChangePayload } from '@/components/plus-table';
import { useEmitEffect, type DocumentLine } from '@/composables';
import { CURRENCY_OPTIONS, WAREHOUSE_OPTIONS, formatSource } from './emit-helpers';
import {
  SALES_CUSTOMER_OPTIONS,
  createSalesOrderDraft,
  salesOrderColumns,
  salesOrderRules,
} from './sales-order-linkage';

defineOptions({ name: 'SalesOrderLinkageDemo' });

const statusText = ref('单据已载入');
let nextLineId = 3;

const { draft, changeHeader, changeCell, addLine, removeLine } = useEmitEffect(
  salesOrderRules,
  createSalesOrderDraft(),
  {
    confirm: async (confirmation) => {
      try {
        await ElMessageBox.confirm(confirmation.message, '确认传播', {
          type: 'warning',
          confirmButtonText: '应用',
          cancelButtonText: '取消',
        });
        return true;
      } catch {
        return false;
      }
    },
  },
);

async function onHeaderChange(field: string, value: unknown) {
  if (Object.is(draft.value.header[field], value)) return;
  const ok = await changeHeader(field, value);
  statusText.value = ok ? `已应用表头「${field}」变更` : '已取消表头传播';
}

async function onCellChange(payload: CellChangePayload<DocumentLine>) {
  const ok = await changeCell({
    rowId: payload.row.id,
    prop: payload.prop,
    value: payload.value,
    oldValue: payload.oldValue,
  });
  if (!ok) {
    payload.row[payload.prop] = payload.oldValue;
    return;
  }
  statusText.value = `已更新明细「${payload.prop}」并重算汇总`;
}

function onAddLine() {
  addLine(String(nextLineId++));
  statusText.value = '已新增明细并重新汇总';
}

async function onRemoveLine(id: string) {
  if (draft.value.lines.length <= 1) return;
  try {
    await ElMessageBox.confirm('删除后将重新汇总整张单据。', '删除明细', {
      type: 'warning',
    });
    removeLine(id);
    statusText.value = '已删除明细并重新汇总';
  } catch {
    /* cancelled */
  }
}
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      销售订单演示表头→明细副作用：币种
      <code>force</code>（默认汇率时改币种会带出新汇率）、仓库/税率 <code>inherit</code>、客户/汇率
      <code>recalculate</code>。明细改仓库/税率/单价后标记为人工值；行金额
      <code>quantity × unitPrice × (1 + taxRate)</code>，本位币
      <code>amount × exchangeRate</code> 汇总到表头。手改汇率后改币种不覆盖。
    </template>

    <DemoBlock>
      <template #hint>
        改币种时若汇率仍是旧币种默认值会带出新默认汇率；手改汇率后改币种会保留。状态：{{
          statusText
        }}
      </template>

      <el-form class="erp-page__header" label-position="top" :model="draft.header">
        <el-form-item label="客户 · 触发重算">
          <el-select
            :model-value="draft.header.customerId"
            @change="onHeaderChange('customerId', $event)"
          >
            <el-option
              v-for="option in SALES_CUSTOMER_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="币种 · 强制同步">
          <el-select
            :model-value="draft.header.currency"
            @change="onHeaderChange('currency', $event)"
          >
            <el-option
              v-for="option in CURRENCY_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="汇率 · 触发重算">
          <el-input-number
            class="w-full!"
            :model-value="Number(draft.header.exchangeRate)"
            :min="0.01"
            :step="0.1"
            :precision="2"
            controls-position="right"
            @change="onHeaderChange('exchangeRate', $event)"
          />
        </el-form-item>
        <el-form-item label="仓库 · 继承传播">
          <el-select
            :model-value="draft.header.warehouseId"
            @change="onHeaderChange('warehouseId', $event)"
          >
            <el-option
              v-for="option in WAREHOUSE_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="默认税率 · 继承传播">
          <el-input-number
            class="w-full!"
            :model-value="Number(draft.header.taxRate)"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            controls-position="right"
            @change="onHeaderChange('taxRate', $event)"
          />
        </el-form-item>
      </el-form>

      <PlusTable
        :data="draft.lines"
        :columns="salesOrderColumns"
        row-key="id"
        mode="cell"
        border
        @cell-change="onCellChange"
      >
        <template #toolbar>
          <el-button type="primary" @click="onAddLine">新增明细</el-button>
        </template>
        <template #cell-source="{ row }">
          {{ formatSource(row, ['unitPrice', 'warehouseId', 'taxRate']) }}
        </template>
        <template #cell-actions="{ row }">
          <el-button
            type="danger"
            link
            :disabled="draft.lines.length <= 1"
            @click.stop="onRemoveLine(row.id)"
          >
            删除
          </el-button>
        </template>
      </PlusTable>

      <div
        class="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-[var(--el-border-color-lighter)] pt-3"
      >
        <div class="min-w-28">
          <div class="text-xs text-[var(--el-text-color-secondary)]">数量合计</div>
          <div
            class="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-[var(--el-text-color-primary)]"
          >
            {{ draft.summary.totalQty ?? 0 }}
          </div>
        </div>
        <div class="min-w-28">
          <div class="text-xs text-[var(--el-text-color-secondary)]">含税合计</div>
          <div
            class="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-[var(--el-text-color-primary)]"
          >
            {{ draft.summary.totalAmount ?? 0 }}
          </div>
        </div>
        <div class="min-w-28">
          <div class="text-xs text-[var(--el-text-color-secondary)]">本位币合计</div>
          <div
            class="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-[var(--el-color-primary)]"
          >
            {{ draft.summary.totalLocalAmount ?? 0 }}
          </div>
        </div>
        <div class="ml-auto flex items-center self-center">
          <span
            class="rounded-full px-2.5 py-0.5 text-xs font-medium"
            :class="
              draft.dirty
                ? 'bg-[var(--el-color-warning-light-9)] text-[var(--el-color-warning-dark-2)]'
                : 'bg-[var(--el-color-success-light-9)] text-[var(--el-color-success-dark-2)]'
            "
          >
            {{ draft.dirty ? '有未保存修改' : '干净草稿' }}
          </span>
        </div>
      </div>
    </DemoBlock>
  </DemoPage>
</template>

<style scoped>
.erp-page__header {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px 16px;
  margin-bottom: 16px;
}
</style>
