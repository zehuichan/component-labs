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
import {
  CURRENCY_OPTIONS,
  DEPARTMENT_OPTIONS,
  EMPLOYEE_OPTIONS,
  PROJECT_OPTIONS,
} from './mock-master-data';
import {
  EXPENSE_FIELD_LABELS,
  createExpenseLine,
  createExpenseReportSeed,
  defaultExpenseReportForm,
  expenseReportColumns,
  expenseReportManualFields,
  expenseReportRules,
  type ExpenseLine,
  type ExpenseReportForm,
} from './expense-report-linkage';

defineOptions({ name: 'ExpenseReportLinkageDemo' });

const form = ref<ExpenseReportForm>(cloneDeep(defaultExpenseReportForm));
const { pending, isManual, restore, normalize } = useEmitEffect(form, expenseReportRules, {
  confirm: useConfirmDialog(EXPENSE_FIELD_LABELS),
  immediate: true,
});

const nextId = createTempIdFactory();
const submitted = ref('');

const summary = computed(() => [
  { label: '原币合计', value: form.value.totalAmount },
  { label: '可抵扣税额', value: form.value.totalDeductibleTax },
  { label: '本位币合计', value: form.value.totalLocalAmount },
  { label: '应付金额（扣预借）', value: form.value.payableAmount, primary: true },
]);

function loadSeed() {
  form.value = createExpenseReportSeed();
  submitted.value = '';
}

async function newDocument() {
  form.value = cloneDeep(defaultExpenseReportForm);
  submitted.value = '';
  await normalize();
}

function addLine() {
  form.value.lines.push(createExpenseLine(nextId()));
}

function removeLine(row: ExpenseLine) {
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
      费用报销：报销人带出部门（可手改），部门 / 项目下发到未手改的行；费用类型 ×
      金额估算可抵扣税额（可手改，改金额或类型后重估）；本位币金额 = (原币 − 可抵扣) ×
      汇率；表头四个合计与「应付金额 = 本位币合计 − 预借款」都是入库字段。
    </template>

    <DemoBlock>
      <template #hint>
        示例单据第 2
        行部门是「市场中心」——载入后它不是人工值（载入不产生人工标记），所以改表头部门会把它一起带过去；先手改再改表头则保留。
      </template>

      <div class="mb-3 flex flex-wrap items-center gap-2">
        <el-button @click="loadSeed">载入示例单据</el-button>
        <el-button @click="newDocument">新建空单</el-button>
        <el-button type="primary" :loading="pending" @click="submit">提交</el-button>
        <span class="demo__meta">{{ form.documentNo ?? '未保存单据' }}</span>
      </div>

      <el-form class="erp-page__header" label-position="top" :model="form">
        <el-form-item label="报销人 · 带出部门">
          <el-select v-model="form.employeeId" placeholder="选择报销人">
            <el-option
              v-for="option in EMPLOYEE_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            部门 · 明细继承
            <el-tag
              v-if="isManual('departmentId')"
              class="ml-1"
              size="small"
              type="warning"
              closable
              @close="restore('departmentId')"
            >
              手改
            </el-tag>
          </template>
          <el-select v-model="form.departmentId" placeholder="选择部门">
            <el-option
              v-for="option in DEPARTMENT_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="默认项目 · 明细继承">
          <el-select v-model="form.projectId" placeholder="选择项目">
            <el-option
              v-for="option in PROJECT_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="报销币种 · 明细强制同步">
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
        <el-form-item label="预借款 · 冲抵应付">
          <el-input-number
            v-model="form.advanceAmount"
            class="w-full!"
            :min="0"
            :step="100"
            :precision="2"
            controls-position="right"
          />
        </el-form-item>
      </el-form>

      <PlusTable :data="form.lines" :columns="expenseReportColumns" row-key="id" mode="cell" border>
        <template #toolbar>
          <el-button type="primary" @click="addLine">新增明细</el-button>
        </template>
        <template #cell-source="{ row }">
          <ManualFieldTags
            :row="row"
            :fields="expenseReportManualFields"
            :labels="EXPENSE_FIELD_LABELS"
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
