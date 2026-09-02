/**
 * Master data the ERP demos look values up from. Everything a real system would
 * fetch (prices, rates, fee catalogues) is exposed as an async function with a
 * small delay so the demos exercise the async path of the engine.
 */
import type { SelectOption } from './emit-helpers';

const LOOKUP_DELAY_MS = 120;

function later<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LOOKUP_DELAY_MS));
}

// ---- currency ----

export const CURRENCY_OPTIONS: SelectOption[] = [
  { label: '人民币 CNY', value: 'CNY' },
  { label: '美元 USD', value: 'USD' },
  { label: '欧元 EUR', value: 'EUR' },
];

export const EXCHANGE_RATES: Record<string, number> = {
  CNY: 1,
  USD: 7.2,
  EUR: 7.8,
};

// ---- warehouses ----

export const WAREHOUSE_OPTIONS: SelectOption[] = [
  { label: '上海仓', value: 'WH-SH' },
  { label: '深圳仓', value: 'WH-SZ' },
  { label: '北京仓', value: 'WH-BJ' },
];

// ---- sales ----

export interface Customer {
  id: string;
  name: string;
  /** Multiplier applied to list prices. */
  priceFactor: number;
  defaultWarehouseId: string;
}

export const CUSTOMERS: Customer[] = [
  { id: 'customer-east', name: '华东旗舰客户', priceFactor: 1, defaultWarehouseId: 'WH-SH' },
  { id: 'customer-channel', name: '全国渠道客户', priceFactor: 0.95, defaultWarehouseId: 'WH-BJ' },
];

export const CUSTOMER_OPTIONS: SelectOption[] = CUSTOMERS.map((customer) => ({
  label: customer.name,
  value: customer.id,
}));

export interface Product {
  id: string;
  name: string;
  listPrice: number;
}

export const PRODUCTS: Product[] = [
  { id: 'notebook', name: '商务笔记本', listPrice: 6800 },
  { id: 'monitor', name: '专业显示器', listPrice: 1800 },
  { id: 'service', name: '实施服务', listPrice: 1200 },
];

export const PRODUCT_OPTIONS: SelectOption[] = PRODUCTS.map((product) => ({
  label: product.name,
  value: product.id,
}));

export function customerOf(id: unknown): Customer | undefined {
  return CUSTOMERS.find((customer) => customer.id === id);
}

/** Customer-specific sales price; `undefined` until both sides are chosen. */
export function fetchSalesPrice(
  productId: unknown,
  customerId: unknown,
): Promise<number | undefined> {
  const product = PRODUCTS.find((item) => item.id === productId);
  const customer = customerOf(customerId);
  if (!product || !customer) return later(undefined);
  return later(Math.round(product.listPrice * customer.priceFactor * 100) / 100);
}

// ---- purchase ----

export interface Supplier {
  id: string;
  name: string;
  priceFactor: number;
  paymentTermDays: number;
}

export const SUPPLIERS: Supplier[] = [
  { id: 'supplier-south', name: '华南电子', priceFactor: 1, paymentTermDays: 30 },
  { id: 'supplier-material', name: '精工材料', priceFactor: 0.94, paymentTermDays: 60 },
];

export const SUPPLIER_OPTIONS: SelectOption[] = SUPPLIERS.map((supplier) => ({
  label: supplier.name,
  value: supplier.id,
}));

export interface Material {
  id: string;
  name: string;
  listPrice: number;
}

export const MATERIALS: Material[] = [
  { id: 'panel', name: '显示器面板', listPrice: 950 },
  { id: 'chip', name: '控制芯片', listPrice: 320 },
  { id: 'package', name: '包装箱', listPrice: 18 },
];

export const MATERIAL_OPTIONS: SelectOption[] = MATERIALS.map((material) => ({
  label: material.name,
  value: material.id,
}));

export function supplierOf(id: unknown): Supplier | undefined {
  return SUPPLIERS.find((supplier) => supplier.id === id);
}

export function fetchPurchasePrice(
  materialId: unknown,
  supplierId: unknown,
): Promise<number | undefined> {
  const material = MATERIALS.find((item) => item.id === materialId);
  const supplier = supplierOf(supplierId);
  if (!material || !supplier) return later(undefined);
  return later(Math.round(material.listPrice * supplier.priceFactor * 100) / 100);
}

// ---- expense ----

export const DEPARTMENT_OPTIONS: SelectOption[] = [
  { label: '研发中心', value: 'rd' },
  { label: '市场中心', value: 'marketing' },
  { label: '财务中心', value: 'finance' },
];

export const PROJECT_OPTIONS: SelectOption[] = [
  { label: '阿波罗', value: 'apollo' },
  { label: '凤凰', value: 'phoenix' },
  { label: '内部运营', value: 'internal' },
];

export interface Employee {
  id: string;
  name: string;
  departmentId: string;
}

export const EMPLOYEES: Employee[] = [
  { id: 'emp-zhang', name: '张伟', departmentId: 'rd' },
  { id: 'emp-li', name: '李娜', departmentId: 'marketing' },
  { id: 'emp-wang', name: '王芳', departmentId: 'finance' },
];

export const EMPLOYEE_OPTIONS: SelectOption[] = EMPLOYEES.map((employee) => ({
  label: employee.name,
  value: employee.id,
}));

export function employeeOf(id: unknown): Employee | undefined {
  return EMPLOYEES.find((employee) => employee.id === id);
}

export interface ExpenseType {
  id: string;
  name: string;
  /** Share of the amount that is deductible input tax. */
  deductibleRate: number;
}

export const EXPENSE_TYPES: ExpenseType[] = [
  { id: 'travel', name: '差旅费', deductibleRate: 0.09 },
  { id: 'software', name: '软件服务费', deductibleRate: 0.06 },
  { id: 'entertainment', name: '业务招待费', deductibleRate: 0 },
];

export const EXPENSE_TYPE_OPTIONS: SelectOption[] = EXPENSE_TYPES.map((type) => ({
  label: type.name,
  value: type.id,
}));

export function expenseTypeOf(id: unknown): ExpenseType | undefined {
  return EXPENSE_TYPES.find((type) => type.id === id);
}

// ---- freight quotation ----

export const PORT_OPTIONS: SelectOption[] = [
  { label: '上海港 CNSHA', value: 101 },
  { label: '宁波港 CNNGB', value: 102 },
  { label: '鹿特丹 NLRTM', value: 202 },
  { label: '汉堡 DEHAM', value: 203 },
  { label: '洛杉矶 USLAX', value: 301 },
];

export const CURRENCY_TYPE_OPTIONS: SelectOption[] = [
  { label: '美元 USD', value: 1 },
  { label: '欧元 EUR', value: 2 },
  { label: '人民币 CNY', value: 3 },
];

export const CURRENCY_TYPE_RATES: Record<number, number> = {
  1: 7.18,
  2: 7.8,
  3: 1,
};

export const CARGO_TYPE_OPTIONS: SelectOption[] = [
  { label: '普货', value: 8 },
  { label: '危险品', value: 9 },
  { label: '冷藏', value: 10 },
];

export const CHARGE_UNIT_OPTIONS: SelectOption[] = [
  { label: 'CBM(按体积)', value: 'CBM(按体积)' },
  { label: 'KG(按重量)', value: 'KG(按重量)' },
  { label: '20GP', value: '20GP' },
  { label: '40HQ', value: '40HQ' },
];

export const TRADE_TERM_OPTIONS: SelectOption[] = [
  { label: 'FOB · 起运港交货', value: 'FOB' },
  { label: 'CIF · 到岸价', value: 'CIF' },
  { label: 'DDP · 完税交货', value: 'DDP' },
];

export interface FeeCatalogItem {
  field: string;
  name: string;
  unit: string;
  price: number;
}

export const POL_FEE_CATALOG: FeeCatalogItem[] = [
  { field: 'pol_customs_declaration_fee', name: '报关费', unit: '/票', price: 350 },
  { field: 'pol_trucking_fee', name: '拖车费', unit: '/柜', price: 1200 },
  { field: 'pol_thc', name: '码头操作费 THC', unit: '/柜', price: 980 },
  { field: 'pol_doc_fee', name: '文件费', unit: '/票', price: 450 },
];

export const POD_FEE_CATALOG: FeeCatalogItem[] = [
  { field: 'pod_customs_clearance_fee', name: '目的港清关费', unit: '/票', price: 900 },
  { field: 'pod_delivery_fee', name: '目的港派送费', unit: '/柜', price: 1500 },
  { field: 'pod_thc', name: '目的港码头费', unit: '/柜', price: 1100 },
];

export const MISC_FEE_CATALOG: FeeCatalogItem[] = [
  { field: 'misc_insurance_fee', name: '保险费', unit: '/票', price: 300 },
  { field: 'misc_fumigation_fee', name: '熏蒸费', unit: '/票', price: 500 },
];

export const FEE_CATALOG: FeeCatalogItem[] = [
  ...POL_FEE_CATALOG,
  ...POD_FEE_CATALOG,
  ...MISC_FEE_CATALOG,
];

export function feeCatalogOptions(catalog: FeeCatalogItem[]): SelectOption[] {
  return catalog.map((item) => ({ label: item.name, value: item.field }));
}

export function feeOf(field: unknown): FeeCatalogItem | undefined {
  return FEE_CATALOG.find((item) => item.field === field);
}
