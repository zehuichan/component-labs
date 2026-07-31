<script setup lang="ts">
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoPage from '@/components/demo/demo-page.vue';

defineOptions({ name: 'FiltersApiOverview' });
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      Filters 公开 API 参考。8 个槽位先选字段再填值，字段互斥；值编辑器复用
      <code>initComponentAdapter</code> 注册的全局组件表。交互演示见侧栏「基础筛选」「预设值」。
    </template>

    <template #api>
      <DemoApiTable title="Props">
        <tr>
          <td><code>schema</code></td>
          <td><code>FilterSchemaField[]</code></td>
          <td>必填。可选字段列表；槽位选择器与值编辑器由此驱动。</td>
        </tr>
        <tr>
          <td><code>modelValue</code> / <code>v-model</code></td>
          <td><code>Record&lt;string, unknown&gt;</code></td>
          <td>
            筛选值对象，按 <code>fieldName</code> 存值。默认 <code>{}</code>。挂载时若槽位尚空，会按
            <code>Object.keys(modelValue)</code> 顺序把合法字段填入前若干槽位。
          </td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Events" :headers="['名称', '载荷', '说明']">
        <tr>
          <td><code>search</code></td>
          <td><code>Record&lt;string, unknown&gt;</code></td>
          <td>
            点击「搜索」或在区域内按 Enter 时触发；载荷为当前
            <code>v-model</code> 的浅拷贝。
          </td>
        </tr>
        <tr>
          <td><code>reset</code></td>
          <td>—</td>
          <td>点击「重置」后触发；同时清空 <code>v-model</code>。</td>
        </tr>
        <tr>
          <td><code>update:modelValue</code></td>
          <td><code>Record&lt;string, unknown&gt;</code></td>
          <td>值变更回写（配合 <code>v-model</code>）。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="FilterSchemaField">
        <tr>
          <td><code>fieldName</code></td>
          <td><code>string</code></td>
          <td>必填。字段键，写入 <code>v-model</code> 的 key；各槽位互斥。</td>
        </tr>
        <tr>
          <td><code>label</code></td>
          <td><code>string</code></td>
          <td>必填。槽位「键」选择器展示名。</td>
        </tr>
        <tr>
          <td><code>component</code></td>
          <td><code>ComponentType</code></td>
          <td>
            可选。值编辑器标识，查全局组件表（
            <code>useGlobalShareState().getComponents()</code>）： <code>input</code> /
            <code>textarea</code> / <code>input-number</code> / <code>select</code> /
            <code>date-picker</code> / <code>time-picker</code> / <code>switch</code> /
            <code>checkbox</code>。未识别或未传时回退 <code>input</code>。
          </td>
        </tr>
        <tr>
          <td><code>componentProps</code></td>
          <td><code>Record&lt;string, unknown&gt;</code></td>
          <td>可选。透传给值编辑器（如 select 的 <code>options</code>）。</td>
        </tr>
        <tr>
          <td><code>modelPropName</code></td>
          <td><code>string</code></td>
          <td>可选。自定义 v-model prop 名，默认 <code>modelValue</code>。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Slots" :headers="['名称', '说明']">
        <tr>
          <td>默认插槽</td>
          <td>操作行左侧区域；与右侧「重置 / 搜索」整宽左右排布。不传则左侧留空，按钮仍靠右。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="行为说明" :headers="['项', '说明']">
        <tr>
          <td>槽位数量</td>
          <td>固定 8 个筛选槽（每行 4 列，span=6）+ 1 行整宽操作区（默认插槽 | 重置 / 搜索）。</td>
        </tr>
        <tr>
          <td>字段互斥</td>
          <td>同一 <code>fieldName</code> 不可同时占用多个槽位；已被占用的选项在其它槽禁用。</td>
        </tr>
        <tr>
          <td>Attrs</td>
          <td>
            <code>inheritAttrs: false</code>；根外的透传属性会落到每个 <code>FiltersItem</code>。
          </td>
        </tr>
        <tr>
          <td>导出</td>
          <td>
            <code>import { Filters } from '@/components/filters'</code>；类型含
            <code>FilterSchemaField</code>。
          </td>
        </tr>
      </DemoApiTable>
    </template>
  </DemoPage>
</template>
