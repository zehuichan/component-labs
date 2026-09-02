import type { PlusTableColumnDef } from '@/components/plus-table';
import { defineEmitRules } from '@/composables';
import { money, optionLabel, sum } from './emit-helpers';
import {
  CURRENCY_OPTIONS,
  EXCHANGE_RATES,
  PRODUCT_OPTIONS,
  WAREHOUSE_OPTIONS,
  customerOf,
  fetchSalesPrice,
} from './mock-master-data';

export interface SalesOrderLine {
  id: number;
  productId: string | null;
  quantity: number | null;
  currency: string | null;
  warehouseId: string | null;
  unitPrice: number | null;
  taxRate: number | null;
  amount: number | null;
  localAmount: number | null;
}

export interface SalesOrderForm {
  id: number | null;
  documentNo: string | null;
  customerId: string | null;
  currency: string | null;
  exchangeRate: number | null;
  warehouseId: string | null;
  taxRate: number | null;
  /** Aggregates are stored on the header so the backend can validate them. */
  totalQty: number | null;
  totalAmount: number | null;
  totalLocalAmount: number | null;
  lines: SalesOrderLine[];
}

export const defaultSalesOrderForm: SalesOrderForm = {
  id: null,
  documentNo: null,
  customerId: null,
  currency: 'CNY',
  exchangeRate: null,
  warehouseId: null,
  taxRate: 0.13,
  totalQty: null,
  totalAmount: null,
  totalLocalAmount: null,
  lines: [],
};

export function createSalesLine(id: number): SalesOrderLine {
  return {
    id,
    productId: null,
    quantity: 1,
    currency: null,
    warehouseId: null,
    unitPrice: null,
    taxRate: null,
    amount: null,
    localAmount: null,
  };
}

/** A stored document: every derived value is already present, so loading it rewrites nothing. */
export function createSalesOrderSeed(): SalesOrderForm {
  return {
    id: 1001,
    documentNo: 'SO-20260717-001',
    customerId: 'customer-east',
    currency: 'CNY',
    exchangeRate: 1,
    warehouseId: 'WH-SH',
    taxRate: 0.13,
    totalQty: 6,
    totalAmount: 23504,
    totalLocalAmount: 23504,
    lines: [
      {
        id: 1,
        productId: 'notebook',
        quantity: 2,
        currency: 'CNY',
        warehouseId: 'WH-SH',
        unitPrice: 6800,
        taxRate: 0.13,
        amount: 15368,
        localAmount: 15368,
      },
      {
        id: 2,
        productId: 'monitor',
        quantity: 4,
        currency: 'CNY',
        warehouseId: 'WH-BJ',
        unitPrice: 1800,
        taxRate: 0.13,
        amount: 8136,
        localAmount: 8136,
      },
    ],
  };
}

export const salesOrderRules = defineEmitRules<SalesOrderForm>({
  exchangeRate: { default: ({ form }) => EXCHANGE_RATES[form.currency ?? ''] },
  warehouseId: { default: ({ form }) => customerOf(form.customerId)?.defaultWarehouseId },
  totalQty: ({ form }) => sum(form.lines, 'quantity'),
  totalAmount: ({ form }) => sum(form.lines, 'amount'),
  totalLocalAmount: ({ form }) => sum(form.lines, 'localAmount'),
  lines: {
    currency: ({ form }) => form.currency,
    warehouseId: { default: ({ form }) => form.warehouseId },
    taxRate: { default: ({ form }) => form.taxRate },
    unitPrice: {
      default: ({ row, form }) => fetchSalesPrice(row.productId, form.customerId),
      confirm: true,
    },
    amount: ({ row }) =>
      money((row.quantity ?? 0) * (row.unitPrice ?? 0) * (1 + (row.taxRate ?? 0))),
    localAmount: ({ row, form }) => money((row.amount ?? 0) * (form.exchangeRate ?? 0)),
  },
});

export const SALES_FIELD_LABELS: Record<string, string> = {
  customerId: '客户',
  currency: '币种',
  exchangeRate: '汇率',
  warehouseId: '仓库',
  taxRate: '税率',
  unitPrice: '单价',
};

export const salesOrderManualFields = ['warehouseId', 'taxRate', 'unitPrice'] as const;

export const salesOrderColumns: PlusTableColumnDef[] = [
  { type: 'index', label: '#', width: 54 },
  {
    prop: 'productId',
    label: '商品',
    minWidth: 140,
    editable: true,
    component: 'select',
    componentProps: { options: PRODUCT_OPTIONS },
    formatter: (row: SalesOrderLine) => optionLabel(PRODUCT_OPTIONS, row.productId),
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
    formatter: (row: SalesOrderLine) => optionLabel(CURRENCY_OPTIONS, row.currency),
  },
  {
    prop: 'warehouseId',
    label: '仓库',
    width: 120,
    editable: true,
    component: 'select',
    componentProps: { options: WAREHOUSE_OPTIONS },
    formatter: (row: SalesOrderLine) => optionLabel(WAREHOUSE_OPTIONS, row.warehouseId),
  },
  {
    prop: 'unitPrice',
    label: '单价',
    width: 110,
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
  { prop: 'amount', label: '含税金额', width: 120 },
  { prop: 'localAmount', label: '本位币金额', width: 120 },
  { prop: 'source', label: '人工值', minWidth: 160 },
  { prop: 'actions', type: 'operation', label: '操作', width: 76, fixed: 'right' },
];
