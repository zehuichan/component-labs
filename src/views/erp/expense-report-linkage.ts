import type { PlusTableColumnDef } from '@/components/plus-table';
import { defineEmitRules } from '@/composables';
import { money, optionLabel, sum } from './emit-helpers';
import {
  CURRENCY_OPTIONS,
  DEPARTMENT_OPTIONS,
  EXCHANGE_RATES,
  EXPENSE_TYPE_OPTIONS,
  PROJECT_OPTIONS,
  employeeOf,
  expenseTypeOf,
} from './mock-master-data';

export interface ExpenseLine {
  id: number;
  expenseType: string | null;
  departmentId: string | null;
  projectId: string | null;
  currency: string | null;
  amount: number | null;
  deductibleTax: number | null;
  localAmount: number | null;
}

export interface ExpenseReportForm {
  id: number | null;
  documentNo: string | null;
  employeeId: string | null;
  departmentId: string | null;
  projectId: string | null;
  currency: string | null;
  exchangeRate: number | null;
  /** Advance already paid to the employee, netted from the payable. */
  advanceAmount: number | null;
  totalAmount: number | null;
  totalDeductibleTax: number | null;
  totalLocalAmount: number | null;
  payableAmount: number | null;
  lines: ExpenseLine[];
}

export const defaultExpenseReportForm: ExpenseReportForm = {
  id: null,
  documentNo: null,
  employeeId: null,
  departmentId: null,
  projectId: null,
  currency: 'CNY',
  exchangeRate: null,
  advanceAmount: 0,
  totalAmount: null,
  totalDeductibleTax: null,
  totalLocalAmount: null,
  payableAmount: null,
  lines: [],
};

export function createExpenseLine(id: number): ExpenseLine {
  return {
    id,
    expenseType: 'travel',
    departmentId: null,
    projectId: null,
    currency: null,
    amount: 0,
    deductibleTax: null,
    localAmount: null,
  };
}

export function createExpenseReportSeed(): ExpenseReportForm {
  return {
    id: 3001,
    documentNo: 'EX-20260717-001',
    employeeId: 'emp-zhang',
    departmentId: 'rd',
    projectId: 'apollo',
    currency: 'CNY',
    exchangeRate: 1,
    advanceAmount: 500,
    totalAmount: 2000,
    totalDeductibleTax: 156,
    totalLocalAmount: 1844,
    payableAmount: 1344,
    lines: [
      {
        id: 1,
        expenseType: 'travel',
        departmentId: 'rd',
        projectId: 'apollo',
        currency: 'CNY',
        amount: 1200,
        deductibleTax: 108,
        localAmount: 1092,
      },
      {
        id: 2,
        expenseType: 'software',
        departmentId: 'marketing',
        projectId: 'apollo',
        currency: 'CNY',
        amount: 800,
        deductibleTax: 48,
        localAmount: 752,
      },
    ],
  };
}

export const expenseReportRules = defineEmitRules<ExpenseReportForm>({
  departmentId: { default: ({ form }) => employeeOf(form.employeeId)?.departmentId },
  exchangeRate: { default: ({ form }) => EXCHANGE_RATES[form.currency ?? ''] },
  totalAmount: ({ form }) => sum(form.lines, 'amount'),
  totalDeductibleTax: ({ form }) => sum(form.lines, 'deductibleTax'),
  totalLocalAmount: ({ form }) => sum(form.lines, 'localAmount'),
  payableAmount: ({ form }) =>
    money(Math.max((form.totalLocalAmount ?? 0) - (form.advanceAmount ?? 0), 0)),
  lines: {
    departmentId: { default: ({ form }) => form.departmentId },
    projectId: { default: ({ form }) => form.projectId },
    currency: ({ form }) => form.currency,
    deductibleTax: {
      default: ({ row }) =>
        money((row.amount ?? 0) * (expenseTypeOf(row.expenseType)?.deductibleRate ?? 0)),
    },
    localAmount: ({ row, form }) =>
      money(Math.max((row.amount ?? 0) - (row.deductibleTax ?? 0), 0) * (form.exchangeRate ?? 0)),
  },
});

export const EXPENSE_FIELD_LABELS: Record<string, string> = {
  employeeId: '报销人',
  currency: '币种',
  departmentId: '部门',
  exchangeRate: '汇率',
  projectId: '项目',
  deductibleTax: '可抵扣税额',
};

export const expenseReportManualFields = ['departmentId', 'projectId', 'deductibleTax'] as const;

export const expenseReportColumns: PlusTableColumnDef[] = [
  { type: 'index', label: '#', width: 54 },
  {
    prop: 'expenseType',
    label: '费用类型',
    minWidth: 130,
    editable: true,
    component: 'select',
    componentProps: { options: EXPENSE_TYPE_OPTIONS },
    formatter: (row: ExpenseLine) => optionLabel(EXPENSE_TYPE_OPTIONS, row.expenseType),
  },
  {
    prop: 'departmentId',
    label: '部门',
    width: 120,
    editable: true,
    component: 'select',
    componentProps: { options: DEPARTMENT_OPTIONS },
    formatter: (row: ExpenseLine) => optionLabel(DEPARTMENT_OPTIONS, row.departmentId),
  },
  {
    prop: 'projectId',
    label: '项目',
    width: 120,
    editable: true,
    component: 'select',
    componentProps: { options: PROJECT_OPTIONS },
    formatter: (row: ExpenseLine) => optionLabel(PROJECT_OPTIONS, row.projectId),
  },
  {
    prop: 'currency',
    label: '币种',
    width: 110,
    formatter: (row: ExpenseLine) => optionLabel(CURRENCY_OPTIONS, row.currency),
  },
  {
    prop: 'amount',
    label: '原币金额',
    width: 120,
    editable: true,
    component: 'input-number',
    componentProps: { min: 0, precision: 2 },
  },
  {
    prop: 'deductibleTax',
    label: '可抵扣税额',
    width: 120,
    editable: true,
    component: 'input-number',
    componentProps: { min: 0, precision: 2 },
  },
  { prop: 'localAmount', label: '本位币金额', width: 120 },
  { prop: 'source', label: '人工值', minWidth: 160 },
  { prop: 'actions', type: 'operation', label: '操作', width: 76, fixed: 'right' },
];
