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
  CURRENCY_TYPE_OPTIONS,
  MISC_FEE_CATALOG,
  POD_FEE_CATALOG,
  POL_FEE_CATALOG,
  PORT_OPTIONS,
  TRADE_TERM_OPTIONS,
} from './mock-master-data';
import {
  QUOTATION_FIELD_LABELS,
  createFclQuotationSeed,
  createFeeRow,
  createFileRow,
  createLclQuotationSeed,
  createQuotationItem,
  defaultQuotationForm,
  feeRowManualFields,
  fileColumns,
  miscFeeColumns,
  podFeeColumns,
  polFeeColumns,
  quotationItemColumns,
  quotationItemManualFields,
  quotationRules,
  type QuotationForm,
} from './supplier-quotation-linkage';

defineOptions({ name: 'SupplierQuotationLinkageDemo' });

const form = ref<QuotationForm>(cloneDeep(defaultQuotationForm));
const { pending, isManual, restore, normalize } = useEmitEffect(form, quotationRules, {
  confirm: useConfirmDialog(QUOTATION_FIELD_LABELS),
  immediate: true,
});

const nextId = createTempIdFactory();
const submitted = ref('');

const isFob = computed(() => form.value.trade_term === 'FOB');
const summary = computed(() => [
  { label: '海运费（RMB）', value: form.value.ocean_total, muted: isFob.value },
  { label: '起运港费用', value: form.value.pol_total },
  { label: '目的港费用', value: form.value.pod_total, muted: isFob.value },
  { label: '其他费用', value: form.value.misc_total },
  { label: '报价总额', value: form.value.quote_amount, primary: true },
]);

type FeeTable = 'quote_pol_fee_rows' | 'quote_pod_fee_rows' | 'quote_misc_fee_rows';
type FileTable = 'quote_pol_files' | 'quote_pod_files';

const feeTables: {
  key: FeeTable;
  title: string;
  columns: typeof polFeeColumns;
  firstField: string;
}[] = [
  {
    key: 'quote_pol_fee_rows',
    title: '起运港费用',
    columns: polFeeColumns,
    firstField: POL_FEE_CATALOG[0]!.field,
  },
  {
    key: 'quote_pod_fee_rows',
    title: '目的港费用',
    columns: podFeeColumns,
    firstField: POD_FEE_CATALOG[0]!.field,
  },
  {
    key: 'quote_misc_fee_rows',
    title: '其他费用',
    columns: miscFeeColumns,
    firstField: MISC_FEE_CATALOG[0]!.field,
  },
];

const fileTables: { key: FileTable; title: string }[] = [
  { key: 'quote_pol_files', title: '起运港附件' },
  { key: 'quote_pod_files', title: '目的港附件' },
];

function load(seed: () => QuotationForm) {
  form.value = seed();
  submitted.value = '';
}

async function newDocument() {
  form.value = cloneDeep(defaultQuotationForm);
  submitted.value = '';
  await normalize();
}

function addItem() {
  form.value.quotation_items.push(createQuotationItem(nextId()));
}

function addFee(table: FeeTable, field: string) {
  form.value[table].push(createFeeRow(nextId(), field));
}

function addFile(table: FileTable) {
  const seq = form.value[table].length + 1;
  form.value[table].push(
    createFileRow(nextId(), `附件-${seq}.pdf`, Math.round(50_000 + Math.random() * 500_000)),
  );
}

function removeFrom<T>(list: T[], row: T) {
  const index = list.indexOf(row);
  if (index >= 0) list.splice(index, 1);
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
      供应商报价（<code>gysbjtb</code>）：一张表头 + 六张子表，全部是
      <code>form</code> 上的数组字段，五张 <code>PlusTable</code> 直接 <code>:data</code>
      绑定。外币单价 ⇄
      人民币单价双向换算，改哪一边哪一边就是锚；改币种带出汇率并批量重算人民币单价（弹确认，手改行保留）；费用项从目录带出名称
      / 单位 / 单价；FOB 条款下海运费与目的港费用不计入报价总额。
    </template>

    <DemoBlock>
      <template #hint>
        LCL 示例是 CIF + USD，FCL 示例是 FOB + EUR。把 FCL 切成 CIF
        看报价总额跳变；在费用行改「费用项」，手改过的单价会失效并按目录重取。
      </template>

      <div class="mb-3 flex flex-wrap items-center gap-2">
        <el-button @click="load(createLclQuotationSeed)">载入 LCL 报价</el-button>
        <el-button @click="load(createFclQuotationSeed)">载入 FCL 报价</el-button>
        <el-button @click="newDocument">新建空单</el-button>
        <el-button type="primary" :loading="pending" @click="submit">提交</el-button>
        <span class="demo__meta">{{ form._id ? `报价单 #${form._id}` : '未保存报价' }}</span>
      </div>

      <el-form class="erp-page__header" label-position="top" :model="form">
        <el-form-item label="贸易条款 · 决定总额口径">
          <el-select v-model="form.trade_term">
            <el-option
              v-for="option in TRADE_TERM_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="起运港">
          <el-select v-model="form.loading_prot" placeholder="选择港口">
            <el-option
              v-for="option in PORT_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目的港">
          <el-select v-model="form.destination_port" placeholder="选择港口">
            <el-option
              v-for="option in PORT_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="报价币种 · 带出汇率，重算人民币单价">
          <el-select v-model="form.currency_type" placeholder="选择币种">
            <el-option
              v-for="option in CURRENCY_TYPE_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            汇率
            <el-tag
              v-if="isManual('exchange_rate')"
              class="ml-1"
              size="small"
              type="warning"
              closable
              @close="restore('exchange_rate')"
            >
              手改
            </el-tag>
          </template>
          <el-input-number
            v-model="form.exchange_rate"
            class="w-full!"
            :min="0.0001"
            :step="0.01"
            :precision="4"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="报价有效期">
          <el-date-picker
            v-model="form.quotation_validity_date"
            class="w-full!"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="航程（天）">
          <el-input v-model="form.transit_time" placeholder="如 25" />
        </el-form-item>
        <el-form-item label="包装要求">
          <el-input v-model="form.package_requirement" placeholder="如 标准出口木箱包装" />
        </el-form-item>
        <el-form-item label="货重比">
          <el-input v-model="form.cargo_weight_ratio" placeholder="如 1:500" />
        </el-form-item>
        <el-form-item label="报关行白名单">
          <el-switch v-model="form.in_customs_broker_whitelist" />
        </el-form-item>
      </el-form>

      <h3 class="erp-page__section">海运费明细</h3>
      <PlusTable
        :data="form.quotation_items"
        :columns="quotationItemColumns"
        row-key="id"
        mode="cell"
        border
      >
        <template #toolbar>
          <el-button type="primary" @click="addItem">新增明细</el-button>
        </template>
        <template #cell-source="{ row }">
          <ManualFieldTags
            :row="row"
            :fields="quotationItemManualFields"
            :labels="QUOTATION_FIELD_LABELS"
            :is-manual="isManual"
            @restore="restore([row, $event])"
          />
        </template>
        <template #cell-actions="{ row }">
          <el-button type="danger" link @click.stop="removeFrom(form.quotation_items, row)">
            删除
          </el-button>
        </template>
      </PlusTable>

      <template v-for="table in feeTables" :key="table.key">
        <h3 class="erp-page__section">{{ table.title }}</h3>
        <PlusTable :data="form[table.key]" :columns="table.columns" row-key="id" mode="cell" border>
          <template #toolbar>
            <el-button type="primary" @click="addFee(table.key, table.firstField)">
              新增费用
            </el-button>
          </template>
          <template #cell-source="{ row }">
            <ManualFieldTags
              :row="row"
              :fields="feeRowManualFields"
              :labels="QUOTATION_FIELD_LABELS"
              :is-manual="isManual"
              @restore="restore([row, $event])"
            />
          </template>
          <template #cell-actions="{ row }">
            <el-button type="danger" link @click.stop="removeFrom(form[table.key], row)">
              删除
            </el-button>
          </template>
        </PlusTable>
      </template>

      <div class="grid gap-4 md:grid-cols-2">
        <div v-for="table in fileTables" :key="table.key">
          <h3 class="erp-page__section">{{ table.title }}</h3>
          <PlusTable :data="form[table.key]" :columns="fileColumns" row-key="id" border>
            <template #toolbar>
              <el-button @click="addFile(table.key)">模拟上传</el-button>
            </template>
            <template #cell-actions="{ row }">
              <el-button type="danger" link @click.stop="removeFrom(form[table.key], row)">
                删除
              </el-button>
            </template>
          </PlusTable>
        </div>
      </div>

      <DocumentSummaryBar :items="summary" :pending="pending">
        <span class="text-xs text-[var(--el-text-color-secondary)]">
          {{ isFob ? 'FOB：海运费与目的港费用不计入' : `${form.trade_term}：全额计入` }}
        </span>
      </DocumentSummaryBar>

      <DemoCode
        v-if="submitted"
        class="mt-4"
        :code="submitted"
        lang="json"
        title="提交的 form（normalize 后，与 gysbjtb DTO 同构）"
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

.erp-page__section {
  margin: 16px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}
</style>
