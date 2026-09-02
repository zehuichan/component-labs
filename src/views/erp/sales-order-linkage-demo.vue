<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { cloneDeep } from 'es-toolkit';
import { computed, ref } from 'vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoCode from '@/components/demo/demo-code.vue';
import DemoPage from '@/components/demo/demo-page.vue';
import DocumentSummaryBar from '@/components/demo/document-summary-bar.vue';
import ManualFieldTags from '@/components/demo/manual-field-tags.vue';
import { useConfirmDialog } from '@/components/demo/use-confirm-dialog';
import { PlusTable } from '@/components/plus-table';
import { useEmitEffect } from '@/composables';
import { createTempIdFactory } from './emit-helpers';
import { CURRENCY_OPTIONS, CUSTOMER_OPTIONS, WAREHOUSE_OPTIONS } from './mock-master-data';
import {
  SALES_FIELD_LABELS,
  createSalesLine,
  createSalesOrderSeed,
  defaultSalesOrderForm,
  salesOrderColumns,
  salesOrderManualFields,
  salesOrderRules,
  type SalesOrderForm,
  type SalesOrderLine,
} from './sales-order-linkage';

defineOptions({ name: 'SalesOrderLinkageDemo' });

// Same shape as a CRUD page: declare the form synchronously, replace `.value` when a document loads.
const form = ref<SalesOrderForm>(cloneDeep(defaultSalesOrderForm));
const { pending, isManual, restore, normalize } = useEmitEffect(form, salesOrderRules, {
  confirm: useConfirmDialog(SALES_FIELD_LABELS),
  immediate: true,
});

const nextId = createTempIdFactory();
const submitted = ref('');

const summary = computed(() => [
  { label: '数量合计', value: form.value.totalQty },
  { label: '含税合计', value: form.value.totalAmount },
  { label: '本位币合计', value: form.value.totalLocalAmount, primary: true },
]);

function loadSeed() {
  form.value = createSalesOrderSeed();
  submitted.value = '';
}

async function newDocument() {
  form.value = cloneDeep(defaultSalesOrderForm);
  submitted.value = '';
  await normalize();
}

function addLine() {
  form.value.lines.push(createSalesLine(nextId()));
}

function removeLine(row: SalesOrderLine) {
  const index = form.value.lines.indexOf(row);
  if (index >= 0) form.value.lines.splice(index, 1);
}

async function submit() {
  await normalize();
  submitted.value = JSON.stringify(form.value, null, 2);
  ElMessage.success('已生成提交数据，见下方 JSON');
}
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      销售订单：表单就是提交 DTO，<code>v-model</code> / <code>:data</code> 直绑
      <code>form</code
      >。规则表声明「哪个字段怎么算」，改客户异步重取单价（弹确认、手改价保留）、改币种带出汇率并同步明细、仓库
      / 税率下发到未手改的行；行金额与表头合计随手改即时重算。
    </template>

    <DemoBlock>
      <template #hint>
        「载入示例单据」整体替换 <code>form.value</code>：任何字段都不会被重算。改明细单价 /
        仓库后出现「人工值」标签，点 × 恢复规则值；改同行商品会让手改单价失效。
      </template>

      <div class="mb-3 flex flex-wrap items-center gap-2">
        <el-button @click="loadSeed">载入示例单据</el-button>
        <el-button @click="newDocument">新建空单</el-button>
        <el-button type="primary" :loading="pending" @click="submit">提交</el-button>
        <span class="demo__meta">{{ form.documentNo ?? '未保存单据' }}</span>
      </div>

      <el-form class="erp-page__header" label-position="top" :model="form">
        <el-form-item label="客户 · 重取单价（需确认）">
          <el-select v-model="form.customerId" placeholder="选择客户">
            <el-option
              v-for="option in CUSTOMER_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="币种 · 明细强制同步">
          <el-select v-model="form.currency">
            <el-option
              v-for="option in CURRENCY_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            汇率 · 币种带出
            <el-tag
              v-if="isManual('exchangeRate')"
              class="ml-1"
              size="small"
              type="warning"
              closable
              @close="restore('exchangeRate')"
            >
              手改
            </el-tag>
          </template>
          <el-input-number
            v-model="form.exchangeRate"
            class="w-full!"
            :min="0.01"
            :step="0.1"
            :precision="4"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="仓库 · 客户带出，明细继承">
          <el-select v-model="form.warehouseId" placeholder="选择仓库">
            <el-option
              v-for="option in WAREHOUSE_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="默认税率 · 明细继承">
          <el-input-number
            v-model="form.taxRate"
            class="w-full!"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            controls-position="right"
          />
        </el-form-item>
      </el-form>

      <PlusTable :data="form.lines" :columns="salesOrderColumns" row-key="id" mode="cell" border>
        <template #toolbar>
          <el-button type="primary" @click="addLine">新增明细</el-button>
        </template>
        <template #cell-source="{ row }">
          <ManualFieldTags
            :row="row"
            :fields="salesOrderManualFields"
            :labels="SALES_FIELD_LABELS"
            :is-manual="isManual"
            @restore="restore([row, $event])"
          />
        </template>
        <template #cell-actions="{ row }">
          <el-button type="danger" link @click.stop="removeLine(row)">删除</el-button>
        </template>
      </PlusTable>

      <DocumentSummaryBar :items="summary" :pending="pending" />

      <DemoCode
        v-if="submitted"
        class="mt-4"
        :code="submitted"
        lang="json"
        title="提交的 form（normalize 后）"
      />
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
