import type { PlusTableColumnDef } from '@/components/plus-table';
import { defineEmitRules } from '@/composables';
import { money, optionLabel, sum } from './emit-helpers';
import {
  CURRENCY_OPTIONS,
  EXCHANGE_RATES,
  MATERIAL_OPTIONS,
  WAREHOUSE_OPTIONS,
  fetchPurchasePrice,
  supplierOf,
} from './mock-master-data';

export interface PurchaseOrderLine {
  id: number;
  materialId: string | null;
  quantity: number | null;
  currency: string | null;
  warehouseId: string | null;
  unitPrice: number | null;
  taxRate: number | null;
  amount: number | null;
  localAmount: number | null;
}

export interface PurchaseOrderForm {
  id: number | null;
  documentNo: string | null;
  supplierId: string | null;
  paymentTermDays: number | null;
  currency: string | null;
  exchangeRate: number | null;
  warehouseId: string | null;
  taxRate: number | null;
  totalQty: number | null;
  totalAmount: number | null;
  totalLocalAmount: number | null;
  lines: PurchaseOrderLine[];
}

export const defaultPurchaseOrderForm: PurchaseOrderForm = {
  id: null,
  documentNo: null,
  supplierId: null,
  paymentTermDays: null,
  currency: 'CNY',
  exchangeRate: null,
  warehouseId: 'WH-SH',
  taxRate: 0.13,
  totalQty: null,
  totalAmount: null,
  totalLocalAmount: null,
  lines: [],
};

export function createPurchaseLine(id: number): PurchaseOrderLine {
  return {
    id,
    materialId: null,
    quantity: 1,
    currency: null,
    warehouseId: null,
    unitPrice: null,
    taxRate: null,
    amount: null,
    localAmount: null,
  };
}

export function createPurchaseOrderSeed(): PurchaseOrderForm {
  return {
    id: 2001,
    documentNo: 'PO-20260717-001',
    supplierId: 'supplier-south',
    paymentTermDays: 30,
    currency: 'CNY',
    exchangeRate: 1,
    warehouseId: 'WH-SH',
    taxRate: 0.13,
    totalQty: 30,
    totalAmount: 17967,
    totalLocalAmount: 17967,
    lines: [
      {
        id: 1,
        materialId: 'panel',
        quantity: 10,
        currency: 'CNY',
        warehouseId: 'WH-SH',
        unitPrice: 950,
        taxRate: 0.13,
        amount: 10735,
        localAmount: 10735,
      },
      {
        id: 2,
        materialId: 'chip',
        quantity: 20,
        currency: 'CNY',
        warehouseId: 'WH-BJ',
        unitPrice: 320,
        taxRate: 0.13,
        amount: 7232,
        localAmount: 7232,
      },
    ],
  };
}

export const purchaseOrderRules = defineEmitRules<PurchaseOrderForm>({
  paymentTermDays: { default: ({ form }) => supplierOf(form.supplierId)?.paymentTermDays },
  exchangeRate: { default: ({ form }) => EXCHANGE_RATES[form.currency ?? ''] },
  totalQty: ({ form }) => sum(form.lines, 'quantity'),
  totalAmount: ({ form }) => sum(form.lines, 'amount'),
  totalLocalAmount: ({ form }) => sum(form.lines, 'localAmount'),
  lines: {
    currency: ({ form }) => form.currency,
    warehouseId: { default: ({ form }) => form.warehouseId },
    taxRate: { default: ({ form }) => form.taxRate },
    unitPrice: {
      default: ({ row, form }) => fetchPurchasePrice(row.materialId, form.supplierId),
      confirm: true,
    },
    amount: ({ row }) =>
      money((row.quantity ?? 0) * (row.unitPrice ?? 0) * (1 + (row.taxRate ?? 0))),
    localAmount: ({ row, form }) => money((row.amount ?? 0) * (form.exchangeRate ?? 0)),
  },
});

export const PURCHASE_FIELD_LABELS: Record<string, string> = {
  supplierId: '供应商',
  currency: '币种',
  paymentTermDays: '账期',
  exchangeRate: '汇率',
  warehouseId: '仓库',
  taxRate: '税率',
  unitPrice: '采购单价',
};

export const purchaseOrderManualFields = ['warehouseId', 'taxRate', 'unitPrice'] as const;

export const purchaseOrderColumns: PlusTableColumnDef[] = [
  { type: 'index', label: '#', width: 54 },
  {
    prop: 'materialId',
    label: '物料',
    minWidth: 140,
    editable: true,
    component: 'select',
    componentProps: { options: MATERIAL_OPTIONS },
    formatter: (row: PurchaseOrderLine) => optionLabel(MATERIAL_OPTIONS, row.materialId),
  },
  {
    prop: 'quantity',
    label: '数量',
    width: 100,
    editable: true,
    component: 'input-number',
    componentProps: { min: 1, step: 1 },
  },
  {
    prop: 'currency',
    label: '币种',
    width: 110,
    formatter: (row: PurchaseOrderLine) => optionLabel(CURRENCY_OPTIONS, row.currency),
  },
  {
    prop: 'warehouseId',
    label: '仓库',
    width: 120,
    editable: true,
    component: 'select',
    componentProps: { options: WAREHOUSE_OPTIONS },
    formatter: (row: PurchaseOrderLine) => optionLabel(WAREHOUSE_OPTIONS, row.warehouseId),
  },
  {
    prop: 'unitPrice',
    label: '采购单价',
    width: 120,
    editable: true,
    component: 'input-number',
    componentProps: { min: 0, precision: 2 },
  },
  {
    prop: 'taxRate',
    label: '税率',
    width: 100,
    editable: true,
    component: 'input-number',
    componentProps: { min: 0, max: 1, step: 0.01, precision: 2 },
  },
  { prop: 'amount', label: '价税合计', width: 120 },
  { prop: 'localAmount', label: '本位币金额', width: 120 },
  { prop: 'source', label: '人工值', minWidth: 160 },
  { prop: 'actions', type: 'operation', label: '操作', width: 76, fixed: 'right' },
];
