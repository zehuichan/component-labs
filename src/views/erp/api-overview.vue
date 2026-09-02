<script setup lang="ts">
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoPage from '@/components/demo/demo-page.vue';

defineOptions({ name: 'ErpApiOverview' });
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      ERP 场景是完整单据 demo，不是组件 API。表单就是提交 DTO，
      <code>v-model</code> / <code>:data</code> 直绑
      <code>form</code>；「哪个字段怎么算」写在与表单同构的规则表里。引擎是
      <RouterLink class="text-primary underline" to="/composables/use-emit-effect">
        <code>useEmitEffect</code>
      </RouterLink>
      ，公开 API 与接法见 composables 侧栏。
    </template>

    <template #api>
      <DemoApiTable title="引擎">
        <tr>
          <td><code>useEmitEffect</code></td>
          <td><code>@/composables</code></td>
          <td>
            把规则表挂到已有
            <code>ref</code> / <code>reactive</code> 表单上。
            <RouterLink class="text-primary underline" to="/composables/use-emit-effect"
              >API 与用法</RouterLink
            >
          </td>
        </tr>
        <tr>
          <td><code>defineEmitRules</code></td>
          <td><code>&lt;F&gt;(rules) =&gt; rules</code></td>
          <td>给规则表加上与表单同构的字段级类型推导。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="场景" :headers="['页面', '看点']">
        <tr>
          <td>
            <RouterLink class="text-primary underline" to="/erp/sales-order-linkage"
              >销售订单联动</RouterLink
            >
          </td>
          <td>异步取价、确认框、手改价保留；币种 / 仓库 / 税率下发未手改行。</td>
        </tr>
        <tr>
          <td>
            <RouterLink class="text-primary underline" to="/erp/purchase-order-linkage"
              >采购订单联动</RouterLink
            >
          </td>
          <td>与销售同写法；供应商带出账期并异步重取采购价。</td>
        </tr>
        <tr>
          <td>
            <RouterLink class="text-primary underline" to="/erp/expense-report-linkage"
              >费用报销联动</RouterLink
            >
          </td>
          <td>税额估算、预借款冲抵；表头合计与应付金额都是入库字段。</td>
        </tr>
        <tr>
          <td>
            <RouterLink class="text-primary underline" to="/erp/supplier-quotation-linkage"
              >供应商报价（多子表）</RouterLink
            >
          </td>
          <td>六张子表、外币 ⇄ 人民币双向锚、FOB 条款下部分费用不计入总额。</td>
        </tr>
      </DemoApiTable>
    </template>
  </DemoPage>
</template>
