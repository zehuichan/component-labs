<script setup lang="ts">
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoBlock from '@/components/demo/demo-block.vue';
import DemoCode from '@/components/demo/demo-code.vue';
import DemoPage from '@/components/demo/demo-page.vue';

defineOptions({ name: 'UseEmitEffectDemo' });

const usageSnippet = `// action.vue —— 和普通 CRUD 页一样声明表单，之后只多一行
const form = ref<OrderForm>({ ...defaultForm, cargos: [], dims: [] });
const { pending, isManual, restore, normalize } = useEmitEffect(form, orderRules, {
  confirm: useConfirmDialog(FIELD_LABELS),
});

const getDetail = async () => {
  const res = await getOrder(params.id);
  form.value = res.data; // 整体替换 = 载入：不联动、不改已存值、清空人工标记
};

const submit = async () => {
  await normalize(); // 汇总 / 派生字段与明细严格一致
  await (params.id ? updateOrder : addOrder)(form.value);
};

onMounted(getDetail);`;

const templateSnippet = `<el-form :model="form">
  <el-select v-model="form.currency" />
  <el-input-number v-model="form.exchangeRate" />
  <PlusTable :data="form.cargos" :columns="cargoColumns" row-key="id" mode="cell" />
  <PlusTable :data="form.dims" :columns="dimColumns" row-key="id" mode="cell" />
  <el-button @click="form.cargos.push(createCargo())">加行</el-button>
</el-form>`;

const rulesSnippet = `export const orderRules = defineEmitRules<OrderForm>({
  // 表头字段：{ default } 可被手改，依赖变了再重算
  exchangeRate: { default: ({ form }) => RATES[form.currency] },
  // 表头汇总：纯函数 = compute，永远跟随公式
  totalWeight: ({ form }) => sum(form.cargos, 'feeWeight'),
  // 数组字段 → 行规则表，字段名与行对象一致
  cargos: {
    feeWeight: {
      default: ({ row }) => Math.max(row.grossWeight, row.volume * 167),
      confirm: true, // 表头触发批量重算时先问一次
    },
    amount: ({ row, form }) => money(row.feeWeight * form.unitPrice),
  },
  dims: {
    volume: ({ row }) => money((row.length * row.width * row.height) / 1e6),
  },
});`;
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      <code>useEmitEffect(form, rules, options)</code>
      把「字段怎么算」声明在一张与表单同构的规则表里，然后挂到已有的
      <code>ref</code> / <code>reactive</code> 表单上。表单仍是唯一数据源：模板
      <code>v-model</code> / <code>:data</code> 直绑，代码用赋值、<code>push</code>、<code
        >splice</code
      >
      直接改，引擎按依赖自动重算并只写回变化的字段。完整单据见
      <RouterLink class="text-primary underline" to="/erp/api-overview">ERP 场景</RouterLink>。
    </template>

    <template #api>
      <DemoApiTable title="Rules" :headers="['写法', '语义', '说明']">
        <tr>
          <td><code>field: (ctx) =&gt; value</code></td>
          <td><code>compute</code></td>
          <td>永远跟随公式；用户在该字段上的输入会被重算覆盖（开发期告警）。</td>
        </tr>
        <tr>
          <td><code>field: { default: (ctx) =&gt; value }</code></td>
          <td><code>default</code></td>
          <td>
            建议值。首次遇到且字段为空时填入；已有值只学习依赖不覆盖。用户改过即「人工值」：
            跨层依赖（表头 ⇄ 明细）变化时保留，同层依赖（同行 /
            同表头）由用户改动引发变化时失效重算。
          </td>
        </tr>
        <tr>
          <td><code>{ ..., confirm: true }</code></td>
          <td>确认</td>
          <td>
            表头单字段变更导致该规则批量改值时，先调
            <code>options.confirm</code>；拒绝则表头字段回滚。
          </td>
        </tr>
        <tr>
          <td><code>arrayField: { rowField: rule }</code></td>
          <td>行规则表</td>
          <td>
            对象数组字段自动识别为子表；行规则的 <code>ctx</code> 是
            <code>{ row, rows, form }</code>，表头规则是 <code>{ form }</code>。
          </td>
        </tr>
        <tr>
          <td><code>return undefined</code></td>
          <td>保持</td>
          <td>
            返回 <code>undefined</code> 表示不改当前值（主数据未选全时常用）；返回
            <code>null</code> 会清空。
          </td>
        </tr>
        <tr>
          <td><code>async (ctx) =&gt; ...</code></td>
          <td>异步</td>
          <td>
            支持返回 Promise；同一轮的异步规则并行，<code>await</code> 之后的读取同样计入依赖。
          </td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Options">
        <tr>
          <td><code>form</code></td>
          <td><code>Ref&lt;F&gt; | Reactive&lt;F&gt;</code></td>
          <td>必填（位置参数）。与后端 DTO 同构的表单；子表必须是表单上的数组字段。</td>
        </tr>
        <tr>
          <td><code>rules</code></td>
          <td><code>EmitEffectRules&lt;F&gt;</code></td>
          <td>必填（位置参数）。用 <code>defineEmitRules&lt;F&gt;()</code> 获得字段级类型推导。</td>
        </tr>
        <tr>
          <td><code>confirm</code></td>
          <td><code>(c: EmitEffectConfirmation) =&gt; boolean | Promise&lt;boolean&gt;</code></td>
          <td>可选。未提供时视为同意。</td>
        </tr>
        <tr>
          <td><code>equals</code></td>
          <td><code>(a, b) =&gt; boolean</code></td>
          <td>
            可选。判定「值是否变了」；默认数字与数字字符串相等（<code>1023 == "1023"</code
            >），对象深比较。
          </td>
        </tr>
        <tr>
          <td><code>immediate</code></td>
          <td><code>boolean</code></td>
          <td>可选。挂载后立即 <code>normalize()</code>，适合新建单据 / 演示。</td>
        </tr>
        <tr>
          <td><code>onError</code></td>
          <td><code>(error) =&gt; void</code></td>
          <td>可选。表单改动触发的传播失败时回调；默认 <code>console.error</code>。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Return">
        <tr>
          <td><code>pending</code></td>
          <td><code>Readonly&lt;Ref&lt;boolean&gt;&gt;</code></td>
          <td>是否有传播在排队 / 执行（异步取价时可做 loading）。</td>
        </tr>
        <tr>
          <td><code>isManual</code></td>
          <td><code>(field | [row, field]) =&gt; boolean</code></td>
          <td>该字段是否为人工值；模板中调用会随标记变化重新渲染。</td>
        </tr>
        <tr>
          <td><code>restore</code></td>
          <td><code>(field | [row, field]) =&gt; Promise&lt;void&gt;</code></td>
          <td>清除人工标记并按规则重算该字段（含其下游）。</td>
        </tr>
        <tr>
          <td><code>normalize</code></td>
          <td><code>() =&gt; Promise&lt;void&gt;</code></td>
          <td>
            重算所有 <code>compute</code> 字段、补齐为空的 <code>default</code>；已存 default
            值不覆盖。提交前调用。
          </td>
        </tr>
        <tr>
          <td><code>hydrate</code></td>
          <td>
            <code>(load: () =&gt; void | Promise&lt;void&gt;) =&gt; Promise&lt;void&gt;</code>
          </td>
          <td>
            包裹 <code>Object.assign(form.value, data)</code> 式的局部载入；整体替换
            <code>form.value</code> 无需包裹，自动识别为载入。
          </td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="何时会重算" :headers="['动作', '引擎行为']">
        <tr>
          <td>改表头 / 行字段（赋值、<code>PlusTable</code> 编辑）</td>
          <td>
            只重算读过该字段的规则，链式传播到收敛；被改的 <code>default</code>
            字段标为人工值，本轮不反算。
          </td>
        </tr>
        <tr>
          <td><code>push</code> 新行</td>
          <td>
            新行 <code>compute</code> 全算，<code>default</code> 只填空值；读过该数组的汇总重算。
          </td>
        </tr>
        <tr>
          <td><code>splice</code> 删行</td>
          <td>丢弃该行依赖，读过该数组的汇总重算。</td>
        </tr>
        <tr>
          <td><code>form.value = data</code> / <code>hydrate(fn)</code></td>
          <td>只学习依赖、不写任何值、清空人工标记。</td>
        </tr>
        <tr>
          <td><code>normalize()</code></td>
          <td>等价于「首次遇到」：<code>compute</code> 全算，<code>default</code> 补空。</td>
        </tr>
        <tr>
          <td><code>restore(target)</code></td>
          <td>无视人工标记重算该字段。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Types · EmitEffectConfirmation">
        <tr>
          <td><code>field</code> / <code>oldValue</code> / <code>newValue</code></td>
          <td>—</td>
          <td>触发本次批量重算的表头字段及前后值；拒绝时回滚到 <code>oldValue</code>。</td>
        </tr>
        <tr>
          <td><code>affected</code></td>
          <td><code>FieldRef[]</code></td>
          <td>
            带 <code>confirm</code> 且实际会改值的字段（<code>{ entity?, rowId?, field }</code>）。
          </td>
        </tr>
        <tr>
          <td><code>preservedCount</code></td>
          <td><code>number</code></td>
          <td>带 <code>confirm</code> 但因人工值被保留的字段数。</td>
        </tr>
      </DemoApiTable>
    </template>

    <DemoBlock title="用法">
      <template #hint>
        接到已有 CRUD 页只需多一行
        <code>useEmitEffect</code>。交互单据见侧栏
        <RouterLink class="text-primary underline" to="/erp/sales-order-linkage"
          >销售订单联动</RouterLink
        >。
      </template>
      <DemoCode :code="usageSnippet" lang="ts" title="script" />
      <DemoCode class="mt-3" :code="templateSnippet" lang="vue" title="template" />
    </DemoBlock>

    <DemoBlock title="规则表">
      <DemoCode :code="rulesSnippet" lang="ts" title="order-linkage.ts" />
    </DemoBlock>
  </DemoPage>
</template>
