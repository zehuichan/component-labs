/**
 * Trimmed from the real playground sources so the home page never drifts from
 * the shipped APIs. Keep each snippet short enough to read without scrolling.
 */
export interface HomeSnippet {
  label: string;
  note: string;
  lang: string;
  code: string;
}

export const columnsSnippet: HomeSnippet = {
  label: 'plus-table/columns.ts',
  note: 'mode 切换',
  lang: 'ts',
  code: `const columns = defineColumns<Row>([
  { prop: 'name', label: '名称', editable: true, component: 'input' },
  {
    prop: 'amount',
    label: '金额',
    editable: true,
    component: 'input-number',
    componentProps: { min: 0, step: 100 },
  },
  {
    prop: 'status',
    label: '状态',
    editable: true,
    component: 'select',
    componentProps: { options: statusOptions },
  },
]);`,
};

export const linkageSnippet: HomeSnippet = {
  label: 'erp/sales-order-linkage.ts',
  note: '规则即表单',
  lang: 'ts',
  code: `export const salesOrderRules = defineEmitRules<SalesOrderForm>({
  exchangeRate: { default: ({ form }) => EXCHANGE_RATES[form.currency] },
  totalAmount: ({ form }) => sum(form.lines, 'amount'),
  lines: {
    currency: ({ form }) => form.currency,
    warehouseId: { default: ({ form }) => form.warehouseId },
    unitPrice: { default: ({ row, form }) => fetchSalesPrice(row.productId, form.customerId), confirm: true },
    amount: ({ row }) => money(row.quantity * row.unitPrice * (1 + row.taxRate)),
  },
});

const form = ref({ ...defaultSalesOrderForm });
useEmitEffect(form, salesOrderRules, { confirm });
// 之后：v-model="form.currency"、:data="form.lines"、form.value.lines.push(row)`,
};

export const persistSnippet: HomeSnippet = {
  label: 'composables/persistence.ts',
  note: '不丢输入',
  lang: 'ts',
  code: `const form = ref(createExpenseForm());

const { restore, flush } = useFormDraft(form, 'workbench:expense-draft', {
  debounceMs: 500,
});

const { status, flush: saveNow } = useAutoSave(
  form,
  (value, signal) => api.saveExpense(value, { signal }),
  { debounceMs: 2000 },
);

useSaveHotkey(saveNow);`,
};
