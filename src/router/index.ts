import { createRouter, createWebHistory } from 'vue-router';

import PlaygroundLayout from '@/layouts/playground-layout.vue';
import UseOauth2Demo from '@/views/composables/use-oauth2-demo.vue';
import UseQrconnectDemo from '@/views/composables/use-qrconnect-demo.vue';
import QrconnectCallback from '@/views/composables/qrconnect-callback.vue';
import UseAutoSaveDemo from '@/views/composables/use-auto-save-demo.vue';
import UseFormDraftDemo from '@/views/composables/use-form-draft-demo.vue';
import UseSaveHotkeyDemo from '@/views/composables/use-save-hotkey-demo.vue';
import UseWechatDemo from '@/views/composables/use-wechat-demo.vue';
import UseWecomDemo from '@/views/composables/use-wecom-demo.vue';
import ErpApiOverview from '@/views/erp/api-overview.vue';
import ExpenseReportLinkageDemo from '@/views/erp/expense-report-linkage-demo.vue';
import PurchaseOrderLinkageDemo from '@/views/erp/purchase-order-linkage-demo.vue';
import SalesOrderLinkageDemo from '@/views/erp/sales-order-linkage-demo.vue';
import FiltersApiOverview from '@/views/filters/api-overview.vue';
import FiltersBasicDemo from '@/views/filters/basic-demo.vue';
import FiltersPresetDemo from '@/views/filters/preset-demo.vue';
import ApiOverview from '@/views/plus-table/api-overview.vue';
import BasicEditingDemo from '@/views/plus-table/basic-editing-demo.vue';
import DependenciesValidationDemo from '@/views/plus-table/dependencies-validation-demo.vue';
import HistoryDirtyDemo from '@/views/plus-table/history-dirty-demo.vue';
import AdaptiveHeightDemo from '@/views/plus-table/adaptive-height-demo.vue';
import PaginationRowsDemo from '@/views/plus-table/pagination-rows-demo.vue';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth/wechat',
      name: 'auth-wechat',
      component: QrconnectCallback,
      meta: { title: '微信扫码回调' },
    },
    {
      path: '/',
      component: PlaygroundLayout,
      children: [
        { path: '', redirect: '/plus-table/basic-editing' },
        {
          path: 'plus-table/api-overview',
          name: 'plus-table-api-overview',
          component: ApiOverview,
          meta: { title: 'API Overview', group: 'PlusTable', order: 0 },
        },
        {
          path: 'plus-table/basic-editing',
          name: 'plus-table-basic-editing',
          component: BasicEditingDemo,
          meta: { title: '基础编辑', group: 'PlusTable', order: 1 },
        },
        {
          path: 'plus-table/dependencies-validation',
          name: 'plus-table-dependencies-validation',
          component: DependenciesValidationDemo,
          meta: { title: '联动与校验', group: 'PlusTable', order: 2 },
        },
        {
          path: 'plus-table/history-dirty',
          name: 'plus-table-history-dirty',
          component: HistoryDirtyDemo,
          meta: { title: '历史与脏追踪', group: 'PlusTable', order: 3 },
        },
        {
          path: 'plus-table/pagination-rows',
          name: 'plus-table-pagination-rows',
          component: PaginationRowsDemo,
          meta: { title: '分页与行操作', group: 'PlusTable', order: 4 },
        },
        {
          path: 'plus-table/adaptive-height',
          name: 'plus-table-adaptive-height',
          component: AdaptiveHeightDemo,
          meta: { title: '自适应高度', group: 'PlusTable', order: 5 },
        },
        {
          path: 'filters/api-overview',
          name: 'filters-api-overview',
          component: FiltersApiOverview,
          meta: { title: 'API Overview', group: 'Filters', order: 0 },
        },
        {
          path: 'filters/basic',
          name: 'filters-basic',
          component: FiltersBasicDemo,
          meta: { title: '基础筛选', group: 'Filters', order: 1 },
        },
        {
          path: 'filters/preset',
          name: 'filters-preset',
          component: FiltersPresetDemo,
          meta: { title: '预设值', group: 'Filters', order: 2 },
        },
        {
          path: 'erp/api-overview',
          name: 'erp-api-overview',
          component: ErpApiOverview,
          meta: { title: 'API Overview', group: 'ERP 场景', order: 0 },
        },
        {
          path: 'erp/sales-order-linkage',
          name: 'erp-sales-order-linkage',
          component: SalesOrderLinkageDemo,
          meta: { title: '销售订单联动', group: 'ERP 场景', order: 1, badge: 'beta' },
        },
        {
          path: 'erp/purchase-order-linkage',
          name: 'erp-purchase-order-linkage',
          component: PurchaseOrderLinkageDemo,
          meta: { title: '采购订单联动', group: 'ERP 场景', order: 2, badge: 'beta' },
        },
        {
          path: 'erp/expense-report-linkage',
          name: 'erp-expense-report-linkage',
          component: ExpenseReportLinkageDemo,
          meta: { title: '费用报销联动', group: 'ERP 场景', order: 3, badge: 'beta' },
        },
        {
          path: 'composables/use-auto-save',
          name: 'composables-use-auto-save',
          component: UseAutoSaveDemo,
          meta: { title: 'use-auto-save', group: 'Form', order: 1 },
        },
        {
          path: 'composables/use-form-draft',
          name: 'composables-use-form-draft',
          component: UseFormDraftDemo,
          meta: { title: 'use-form-draft', group: 'Form', order: 2 },
        },
        {
          path: 'composables/use-save-hotkey',
          name: 'composables-use-save-hotkey',
          component: UseSaveHotkeyDemo,
          meta: { title: 'use-save-hotkey', group: 'Form', order: 3 },
        },
        {
          path: 'composables/use-oauth2',
          name: 'composables-use-oauth2',
          component: UseOauth2Demo,
          meta: { title: 'use-oauth2', group: 'WeChat', order: 1 },
        },
        {
          path: 'composables/use-qrconnect',
          name: 'composables-use-qrconnect',
          component: UseQrconnectDemo,
          meta: { title: 'use-qrconnect', group: 'WeChat', order: 2 },
        },
        {
          path: 'composables/use-wechat',
          name: 'composables-use-wechat',
          component: UseWechatDemo,
          meta: { title: 'use-wechat', group: 'WeChat', order: 3 },
        },
        {
          path: 'composables/use-wecom',
          name: 'composables-use-wecom',
          component: UseWecomDemo,
          meta: { title: 'use-wecom', group: 'WeChat', order: 4 },
        },
      ],
    },
  ],
});
