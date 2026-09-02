import type { PlusTableColumnDef } from '@/components/plus-table';
import { defineEmitRules, type RowRules } from '@/composables';
import { money, optionLabel, sum } from './emit-helpers';
import {
  CARGO_TYPE_OPTIONS,
  CHARGE_UNIT_OPTIONS,
  CURRENCY_TYPE_RATES,
  MISC_FEE_CATALOG,
  POD_FEE_CATALOG,
  POL_FEE_CATALOG,
  feeCatalogOptions,
  feeOf,
  type FeeCatalogItem,
} from './mock-master-data';

/** Field names follow the `gysbjtb` DTO so the form is submitted as-is. */
export interface QuotationItem {
  id: number;
  type: number | null;
  charge_unit: string | null;
  quantity: number | null;
  fx_unit_price: number | null;
  rmb_unit_price: number | null;
  fx_amount: number | null;
  rmb_amount: number | null;
}

export interface FeeRow {
  id: number;
  field: string | null;
  fee_name: string | null;
  unit: string | null;
  unit_price: number | null;
  quantity: number | null;
  amount: number | null;
}

export interface FileRow {
  id: number;
  name: string;
  size: number;
}

export type TradeTerm = 'FOB' | 'CIF' | 'DDP';

export interface QuotationForm {
  _key: string;
  _id: number | null;
  trade_term: TradeTerm;
  loading_prot: number | null;
  destination_port: number | null;
  package_requirement: string | null;
  cargo_weight_ratio: string | null;
  currency_type: number | null;
  exchange_rate: number | null;
  quotation_validity_date: string | null;
  transit_time: string | null;
  in_customs_broker_whitelist: boolean;
  /** Aggregates stored for backend validation; all in RMB. */
  ocean_total: number | null;
  pol_total: number | null;
  pod_total: number | null;
  misc_total: number | null;
  quote_amount: number | null;
  quotation_items: QuotationItem[];
  quote_pol_fee_rows: FeeRow[];
  quote_pod_fee_rows: FeeRow[];
  quote_misc_fee_rows: FeeRow[];
  quote_pol_files: FileRow[];
  quote_pod_files: FileRow[];
}

export const defaultQuotationForm: QuotationForm = {
  _key: 'gysbjtb',
  _id: null,
  trade_term: 'CIF',
  loading_prot: null,
  destination_port: null,
  package_requirement: null,
  cargo_weight_ratio: null,
  currency_type: null,
  exchange_rate: null,
  quotation_validity_date: null,
  transit_time: null,
  in_customs_broker_whitelist: false,
  ocean_total: null,
  pol_total: null,
  pod_total: null,
  misc_total: null,
  quote_amount: null,
  quotation_items: [],
  quote_pol_fee_rows: [],
  quote_pod_fee_rows: [],
  quote_misc_fee_rows: [],
  quote_pol_files: [],
  quote_pod_files: [],
};

export function createQuotationItem(id: number): QuotationItem {
  return {
    id,
    type: 8,
    charge_unit: 'CBM(按体积)',
    quantity: 1,
    fx_unit_price: null,
    rmb_unit_price: null,
    fx_amount: null,
    rmb_amount: null,
  };
}

export function createFeeRow(id: number, field: string | null = null): FeeRow {
  return { id, field, fee_name: null, unit: null, unit_price: null, quantity: 1, amount: null };
}

export function createFileRow(id: number, name: string, size: number): FileRow {
  return { id, name, size };
}

/** Picking a catalogue item fills name / unit / price; each stays editable. */
const feeRowRules: RowRules<QuotationForm, FeeRow> = {
  fee_name: { default: ({ row }) => feeOf(row.field)?.name },
  unit: { default: ({ row }) => feeOf(row.field)?.unit },
  unit_price: { default: ({ row }) => feeOf(row.field)?.price },
  amount: ({ row }) => money((row.unit_price ?? 0) * (row.quantity ?? 0)),
};

export const quotationRules = defineEmitRules<QuotationForm>({
  exchange_rate: {
    default: ({ form }) =>
      form.currency_type === null ? undefined : CURRENCY_TYPE_RATES[form.currency_type],
  },
  ocean_total: ({ form }) => sum(form.quotation_items, 'rmb_amount'),
  pol_total: ({ form }) => sum(form.quote_pol_fee_rows, 'amount'),
  pod_total: ({ form }) => sum(form.quote_pod_fee_rows, 'amount'),
  misc_total: ({ form }) => sum(form.quote_misc_fee_rows, 'amount'),
  // FOB stops at the loading port: destination charges and ocean freight are not quoted.
  quote_amount: ({ form }) =>
    money(
      (form.pol_total ?? 0) +
        (form.misc_total ?? 0) +
        (form.trade_term === 'FOB' ? 0 : (form.pod_total ?? 0) + (form.ocean_total ?? 0)),
    ),
  quotation_items: {
    // Two-way price: whichever side the user edits becomes the anchor, the other side follows.
    rmb_unit_price: {
      default: ({ row, form }) =>
        row.fx_unit_price === null || form.exchange_rate === null
          ? undefined
          : money(row.fx_unit_price * form.exchange_rate),
      confirm: true,
    },
    fx_unit_price: {
      default: ({ row, form }) =>
        row.rmb_unit_price === null || !form.exchange_rate
          ? undefined
          : money(row.rmb_unit_price / form.exchange_rate),
    },
    fx_amount: ({ row }) => money((row.quantity ?? 0) * (row.fx_unit_price ?? 0)),
    rmb_amount: ({ row }) => money((row.quantity ?? 0) * (row.rmb_unit_price ?? 0)),
  },
  quote_pol_fee_rows: feeRowRules,
  quote_pod_fee_rows: feeRowRules,
  quote_misc_fee_rows: feeRowRules,
});

export const QUOTATION_FIELD_LABELS: Record<string, string> = {
  trade_term: '贸易条款',
  currency_type: '报价币种',
  exchange_rate: '汇率',
  rmb_unit_price: '人民币单价',
  fx_unit_price: '外币单价',
  fee_name: '费用名称',
  unit: '计费单位',
  unit_price: '单价',
};

export const quotationItemManualFields = ['fx_unit_price', 'rmb_unit_price'] as const;
export const feeRowManualFields = ['fee_name', 'unit', 'unit_price'] as const;

function feeSeed(id: number, field: string, quantity: number): FeeRow {
  const item = feeOf(field)!;
  return {
    id,
    field,
    fee_name: item.name,
    unit: item.unit,
    unit_price: item.price,
    quantity,
    amount: money(item.price * quantity),
  };
}

/** LCL shipment quoted CIF in USD. */
export function createLclQuotationSeed(): QuotationForm {
  return {
    _key: 'gysbjtb',
    _id: 1,
    trade_term: 'CIF',
    loading_prot: 101,
    destination_port: 202,
    package_requirement: '标准出口木箱包装',
    cargo_weight_ratio: '1:500',
    currency_type: 1,
    exchange_rate: 7.18,
    quotation_validity_date: '2026-12-31',
    transit_time: '25',
    in_customs_broker_whitelist: true,
    ocean_total: 7628.75,
    pol_total: 800,
    pod_total: 900,
    misc_total: 300,
    quote_amount: 9628.75,
    quotation_items: [
      {
        id: 1,
        type: 8,
        charge_unit: 'CBM(按体积)',
        quantity: 12.5,
        fx_unit_price: 85,
        rmb_unit_price: 610.3,
        fx_amount: 1062.5,
        rmb_amount: 7628.75,
      },
    ],
    quote_pol_fee_rows: [
      feeSeed(1, 'pol_customs_declaration_fee', 1),
      feeSeed(2, 'pol_doc_fee', 1),
    ],
    quote_pod_fee_rows: [feeSeed(3, 'pod_customs_clearance_fee', 1)],
    quote_misc_fee_rows: [feeSeed(4, 'misc_insurance_fee', 1)],
    quote_pol_files: [createFileRow(1, '装箱单.pdf', 182_340)],
    quote_pod_files: [],
  };
}

/** FCL shipment quoted FOB in EUR: ocean freight and destination charges are listed but not totalled. */
export function createFclQuotationSeed(): QuotationForm {
  return {
    _key: 'gysbjtb',
    _id: 2,
    trade_term: 'FOB',
    loading_prot: 102,
    destination_port: 203,
    package_requirement: '托盘缠膜',
    cargo_weight_ratio: '1:1000',
    currency_type: 2,
    exchange_rate: 7.8,
    quotation_validity_date: '2026-10-31',
    transit_time: '32',
    in_customs_broker_whitelist: false,
    ocean_total: 37440,
    pol_total: 6890,
    pod_total: 7800,
    misc_total: 500,
    quote_amount: 7390,
    quotation_items: [
      {
        id: 1,
        type: 8,
        charge_unit: '40HQ',
        quantity: 2,
        fx_unit_price: 1850,
        rmb_unit_price: 14430,
        fx_amount: 3700,
        rmb_amount: 28860,
      },
      {
        id: 2,
        type: 9,
        charge_unit: '20GP',
        quantity: 1,
        fx_unit_price: 1100,
        rmb_unit_price: 8580,
        fx_amount: 1100,
        rmb_amount: 8580,
      },
    ],
    quote_pol_fee_rows: [
      feeSeed(1, 'pol_trucking_fee', 3),
      feeSeed(2, 'pol_thc', 3),
      feeSeed(3, 'pol_customs_declaration_fee', 1),
    ],
    quote_pod_fee_rows: [feeSeed(4, 'pod_delivery_fee', 3), feeSeed(5, 'pod_thc', 3)],
    quote_misc_fee_rows: [feeSeed(6, 'misc_fumigation_fee', 1)],
    quote_pol_files: [
      createFileRow(1, '订舱委托书.pdf', 96_120),
      createFileRow(2, '危包证.jpg', 1_204_770),
    ],
    quote_pod_files: [createFileRow(3, '目的港代理确认.eml', 24_500)],
  };
}

export const quotationItemColumns: PlusTableColumnDef[] = [
  { type: 'index', label: '#', width: 54 },
  {
    prop: 'type',
    label: '货物类型',
    width: 120,
    editable: true,
    component: 'select',
    componentProps: { options: CARGO_TYPE_OPTIONS },
    formatter: (row: QuotationItem) => optionLabel(CARGO_TYPE_OPTIONS, row.type),
  },
  {
    prop: 'charge_unit',
    label: '计费单位',
    width: 140,
    editable: true,
    component: 'select',
    componentProps: { options: CHARGE_UNIT_OPTIONS },
  },
  {
    prop: 'quantity',
    label: '数量',
    width: 100,
    editable: true,
    component: 'input-number',
    componentProps: { min: 0, precision: 2 },
  },
  {
    prop: 'fx_unit_price',
    label: '外币单价',
    width: 120,
    editable: true,
    component: 'input-number',
    componentProps: { min: 0, precision: 2 },
  },
  {
    prop: 'rmb_unit_price',
    label: '人民币单价',
    width: 120,
    editable: true,
    component: 'input-number',
    componentProps: { min: 0, precision: 2 },
  },
  { prop: 'fx_amount', label: '外币金额', width: 110 },
  { prop: 'rmb_amount', label: '人民币金额', width: 120 },
  { prop: 'source', label: '人工值', minWidth: 150 },
  { prop: 'actions', type: 'operation', label: '操作', width: 76, fixed: 'right' },
];

export function createFeeColumns(catalog: FeeCatalogItem[]): PlusTableColumnDef[] {
  const options = feeCatalogOptions(catalog);
  return [
    { type: 'index', label: '#', width: 54 },
    {
      prop: 'field',
      label: '费用项',
      minWidth: 150,
      editable: true,
      component: 'select',
      componentProps: { options },
      formatter: (row: FeeRow) => optionLabel(options, row.field),
    },
    { prop: 'fee_name', label: '费用名称', width: 150, editable: true, component: 'input' },
    { prop: 'unit', label: '计费单位', width: 100, editable: true, component: 'input' },
    {
      prop: 'unit_price',
      label: '单价',
      width: 110,
      editable: true,
      component: 'input-number',
      componentProps: { min: 0, precision: 2 },
    },
    {
      prop: 'quantity',
      label: '数量',
      width: 100,
      editable: true,
      component: 'input-number',
      componentProps: { min: 0, precision: 2 },
    },
    { prop: 'amount', label: '金额', width: 110 },
    { prop: 'source', label: '人工值', minWidth: 150 },
    { prop: 'actions', type: 'operation', label: '操作', width: 76, fixed: 'right' },
  ];
}

export const polFeeColumns = createFeeColumns(POL_FEE_CATALOG);
export const podFeeColumns = createFeeColumns(POD_FEE_CATALOG);
export const miscFeeColumns = createFeeColumns(MISC_FEE_CATALOG);

export const fileColumns: PlusTableColumnDef[] = [
  { type: 'index', label: '#', width: 54 },
  { prop: 'name', label: '文件名', minWidth: 200 },
  {
    prop: 'size',
    label: '大小',
    width: 120,
    formatter: (row: FileRow) => `${(row.size / 1024).toFixed(1)} KB`,
  },
  { prop: 'actions', type: 'operation', label: '操作', width: 76, fixed: 'right' },
];
