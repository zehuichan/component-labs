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
  note: '一处声明',
  lang: 'ts',
  code: `export const salesOrderRules: EmitEffectRules = {
  sourceFields: ['unitPrice', 'warehouseId', 'taxRate'],
  headerRules: {
    customerId: repriceInheritedField('unitPrice', resolveSalesPrice),
    currency: forceCurrencyWithRate(),
    warehouseId: inheritField('warehouseId', 'warehouseId'),
    taxRate: inheritField('taxRate', 'taxRate'),
  },
  recalculateLine: recalculateSalesLine,
  summarize: (lines) => ({ totalAmount: sum(lines, 'amount') }),
};

const { draft, changeHeader } = useEmitEffect(salesOrderRules, createSalesOrderDraft());`,
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
