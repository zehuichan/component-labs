<script setup lang="ts">
import DemoApiTable from '@/components/demo/demo-api-table.vue';
import DemoPage from '@/components/demo/demo-page.vue';

defineOptions({ name: 'ApiOverview' });
</script>

<template>
  <DemoPage width="wide">
    <template #description>
      PlusTable 完整公开 API 参考。交互与场景说明见侧栏其它 demo。未列出的
      <code>el-table</code> 属性经 <code>$attrs</code> 透传；列上 <code>width</code> /
      <code>align</code> / <code>fixed</code> / <code>sortable</code> / <code>formatter</code> 等
      <code>el-table-column</code> 字段可直通。
    </template>

    <template #api>
      <DemoApiTable title="Props">
        <tr>
          <td><code>data</code> / <code>v-model:data</code></td>
          <td><code>T[]</code></td>
          <td>必填。表格数据；编辑经 <code>update:data</code> 回写。</td>
        </tr>
        <tr>
          <td><code>columns</code></td>
          <td><code>PlusTableColumn&lt;T&gt;[]</code></td>
          <td>
            必填。列配置；字面量数组用 <code>defineColumns&lt;Row&gt;([...])</code>
            包一层即可获得行类型（prop 收敛到字段名，回调参数带类型）。
          </td>
        </tr>
        <tr>
          <td><code>row-key</code></td>
          <td><code>keyof T | (row) =&gt; string | number</code></td>
          <td>必填。行唯一标识；函数须纯且仅从行字段派生。</td>
        </tr>
        <tr>
          <td><code>mode</code></td>
          <td><code>'none' | 'cell' | 'row' | 'table'</code></td>
          <td>默认 <code>cell</code>。编辑模式。</td>
        </tr>
        <tr>
          <td><code>validate-event</code></td>
          <td><code>boolean</code></td>
          <td>默认 <code>true</code>。为 false 时仅 <code>ref.validate()</code> 触发校验。</td>
        </tr>
        <tr>
          <td><code>cache</code></td>
          <td><code>boolean</code></td>
          <td>
            默认 <code>false</code>。缓存列设置（显隐 / 顺序 / 列宽）；为 true 时需同时传
            <code>id</code>。
          </td>
        </tr>
        <tr>
          <td><code>id</code></td>
          <td><code>string</code></td>
          <td>列设置缓存标识；多实例需各自唯一。</td>
        </tr>
        <tr>
          <td><code>adaptive</code></td>
          <td><code>boolean | AdaptiveConfig</code></td>
          <td>
            默认 <code>false</code>。自适应高度；可配
            <code>mode: 'viewport' | 'container'</code> 等。
          </td>
        </tr>
        <tr>
          <td><code>total</code></td>
          <td><code>number</code></td>
          <td>传入即启用分页 UI；组件不切片，由业务提供当前页 data。</td>
        </tr>
        <tr>
          <td><code>page</code> / <code>v-model:page</code></td>
          <td><code>number</code></td>
          <td>默认 <code>1</code>。当前页。</td>
        </tr>
        <tr>
          <td><code>page-size</code> / <code>v-model:pageSize</code></td>
          <td><code>number</code></td>
          <td>默认 <code>20</code>。每页条数。</td>
        </tr>
        <tr>
          <td><code>page-sizes</code></td>
          <td><code>number[]</code></td>
          <td>默认 <code>[10, 20, 50, 100]</code>。</td>
        </tr>
        <tr>
          <td><code>history</code></td>
          <td><code>boolean</code></td>
          <td>默认 <code>false</code>。单元格变更撤销 / 重做。</td>
        </tr>
        <tr>
          <td><code>dirty-tracking</code></td>
          <td><code>boolean</code></td>
          <td>默认 <code>false</code>。脏行 / 脏格追踪。</td>
        </tr>
        <tr>
          <td><code>hotkeys</code></td>
          <td><code>HotkeyBinding[]</code></td>
          <td>自定义热键绑定（不影响内置方向键导航）。</td>
        </tr>
        <tr>
          <td><code>hotkey-enabled</code></td>
          <td><code>boolean</code></td>
          <td>默认 <code>true</code>。自定义热键总开关。</td>
        </tr>
        <tr>
          <td><code>context-menu</code></td>
          <td><code>ContextMenuItem[] | (ctx) =&gt; ContextMenuItem[]</code></td>
          <td>表体自定义右键菜单；不传或解析为空则保留浏览器原生菜单。</td>
        </tr>
        <tr>
          <td><code>context-menu-enabled</code></td>
          <td><code>boolean</code></td>
          <td>默认 <code>true</code>。右键菜单总开关（含表头内置菜单）。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Events" :headers="['名称', '载荷', '说明']">
        <tr>
          <td><code>update:data</code></td>
          <td><code>T[]</code></td>
          <td>数据变更回写（配合 <code>v-model:data</code>）。</td>
        </tr>
        <tr>
          <td><code>cell-change</code></td>
          <td><code>{ row, rowIndex, prop, value, oldValue }</code></td>
          <td>单个单元格值变更。</td>
        </tr>
        <tr>
          <td><code>update:page</code> / <code>update:pageSize</code></td>
          <td><code>number</code></td>
          <td>分页控件变更。</td>
        </tr>
        <tr>
          <td><code>page-change</code></td>
          <td><code>{ page, pageSize }</code></td>
          <td>页码或 pageSize 变化时一并抛出，便于拉数。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Slots" :headers="['名称', '说明']">
        <tr>
          <td><code>#title</code></td>
          <td>顶栏左侧标题区，与 toolbar 同一行（有 title 或 toolbar 时显示顶栏）。</td>
        </tr>
        <tr>
          <td><code>#toolbar</code></td>
          <td>顶栏工具区。列设置改为表头右键（隐藏 / 设置）。</td>
        </tr>
        <tr>
          <td><code>#summary</code></td>
          <td>
            底栏左侧汇总；有分页时与分页同行，无
            <code>total</code> 时仍可单独显示。
          </td>
        </tr>
        <tr>
          <td><code>#empty</code></td>
          <td>透传到底层 <code>el-table</code> 空状态。</td>
        </tr>
        <tr>
          <td><code>#cell-&#123;prop&#125;</code></td>
          <td>展示态单元格插槽；参数为 <code>CellContext</code>。</td>
        </tr>
        <tr>
          <td><code>#header-&#123;prop&#125;</code></td>
          <td>表头插槽；参数为 <code>{ column }</code>。</td>
        </tr>
        <tr>
          <td><code>#editor-&#123;prop&#125;</code></td>
          <td>
            编辑态插槽；参数含
            <code>value</code> / <code>setValue</code> / <code>commit</code> / <code>cancel</code>。
          </td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Expose · 校验">
        <tr>
          <td><code>validate</code></td>
          <td><code>() =&gt; Promise&lt;ValidateResult&gt;</code></td>
          <td>全表校验；返回 <code>{ valid, errors }</code>。</td>
        </tr>
        <tr>
          <td><code>clearValidate</code></td>
          <td><code>() =&gt; void</code></td>
          <td>清空当前校验错误。</td>
        </tr>
        <tr>
          <td><code>getErrors</code></td>
          <td><code>() =&gt; CellError[]</code></td>
          <td>读取当前错误列表。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Expose · 行操作" :headers="['名称', '说明']">
        <tr>
          <td><code>insertRow(row, index?)</code></td>
          <td>插入行并 <code>update:data</code>。</td>
        </tr>
        <tr>
          <td><code>removeRow(index)</code></td>
          <td>按当前 <code>data</code> 下标删除。</td>
        </tr>
        <tr>
          <td><code>moveRow(from, to)</code></td>
          <td>移动行。</td>
        </tr>
        <tr>
          <td><code>duplicateRow(index, patch)</code></td>
          <td>复制行；须用 <code>patch</code> 覆盖新 <code>rowKey</code>。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Expose · 编辑">
        <tr>
          <td><code>startEdit</code> / <code>cancelEdit</code></td>
          <td><code>() =&gt; void</code></td>
          <td>cell 模式：对活动格进编 / 取消。</td>
        </tr>
        <tr>
          <td>
            <code>startRowEdit</code> / <code>commitRowEdit</code> /
            <code>cancelRowEdit</code>
          </td>
          <td>行编辑 API</td>
          <td>row 模式：开始 / 提交 / 取消整行编辑。</td>
        </tr>
        <tr>
          <td><code>setActiveCell</code></td>
          <td>定位活动格</td>
          <td>设置当前活动单元格（不必然进入编辑态）。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Expose · 列设置">
        <tr>
          <td><code>resetColumnSettings</code></td>
          <td><code>() =&gt; void</code></td>
          <td>重置列显隐 / 顺序 / 列宽（含缓存）。</td>
        </tr>
        <tr>
          <td><code>setColumnWidth</code></td>
          <td><code>(prop, width: number | null) =&gt; void</code></td>
          <td>
            设置列宽；传 <code>null</code> 为强制自动宽度，会压过列配置里的 <code>width</code>。
          </td>
        </tr>
        <tr>
          <td><code>clearColumnWidth</code></td>
          <td><code>(prop) =&gt; void</code></td>
          <td>撤掉列宽覆盖，回到列配置的 <code>width</code>；未配置则由 el-table 自动分配。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Expose · 历史">
        <tr>
          <td><code>undo</code> / <code>redo</code></td>
          <td><code>() =&gt; AppliedChange[]</code></td>
          <td>撤销 / 重做；关闭 history 时为空操作。</td>
        </tr>
        <tr>
          <td><code>canUndo</code> / <code>canRedo</code></td>
          <td><code>ComputedRef&lt;boolean&gt;</code></td>
          <td>是否可撤销 / 重做。</td>
        </tr>
        <tr>
          <td><code>clearHistory</code></td>
          <td><code>() =&gt; void</code></td>
          <td>清空撤销重做栈。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Expose · 脏追踪">
        <tr>
          <td><code>getModifiedRows</code></td>
          <td><code>() =&gt; T[]</code></td>
          <td>当前有脏格的行。</td>
        </tr>
        <tr>
          <td><code>getDirtyCells</code></td>
          <td><code>() =&gt; DirtyCell[]</code></td>
          <td>
            每项为
            <code>{ rowKey: string; prop: string }</code>。
          </td>
        </tr>
        <tr>
          <td><code>isCellDirty</code> / <code>isRowDirty</code></td>
          <td>谓词</td>
          <td>判断单格 / 整行是否脏。</td>
        </tr>
        <tr>
          <td><code>resetTracking</code></td>
          <td><code>() =&gt; void</code></td>
          <td>以当前 data 为新基线并清空脏标记。</td>
        </tr>
        <tr>
          <td><code>clearDirty</code></td>
          <td><code>(rowKey?, prop?) =&gt; void</code></td>
          <td>按范围清除脏标记（不改数据）。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="Column">
        <tr>
          <td><code>prop</code></td>
          <td><code>keyof T &amp; string</code></td>
          <td>字段名；特殊列可省略，改用 <code>type</code>。</td>
        </tr>
        <tr>
          <td><code>type</code></td>
          <td>
            <code>'index' | 'selection' | 'expand' | 'operation'</code>
          </td>
          <td>特殊列类型；前三者走 el-table 原生渲染。</td>
        </tr>
        <tr>
          <td><code>editable</code></td>
          <td><code>boolean | (ctx) =&gt; boolean</code></td>
          <td>是否可编辑。</td>
        </tr>
        <tr>
          <td><code>component</code></td>
          <td><code>BuiltinEditorType | Component</code></td>
          <td>
            编辑控件。内置：<code>input</code> / <code>textarea</code> / <code>input-number</code> /
            <code>select</code> / <code>date-picker</code> / <code>time-picker</code> /
            <code>switch</code> / <code>checkbox</code>。
          </td>
        </tr>
        <tr>
          <td><code>componentProps</code></td>
          <td><code>object | (ctx) =&gt; object</code></td>
          <td>透传编辑器 props；可被 dependencies 同名项覆盖。</td>
        </tr>
        <tr>
          <td><code>modelProp</code></td>
          <td><code>string</code></td>
          <td>自定义组件 v-model prop 名，默认 <code>modelValue</code>。</td>
        </tr>
        <tr>
          <td><code>required</code></td>
          <td><code>boolean</code></td>
          <td>静态必填。</td>
        </tr>
        <tr>
          <td><code>rules</code></td>
          <td><code>RuleItem[]</code></td>
          <td>async-validator 规则；与联动动态 rules 合并。</td>
        </tr>
        <tr>
          <td><code>render</code></td>
          <td><code>(ctx) =&gt; VNodeChild</code></td>
          <td>展示态自定义渲染，优先级高于 formatter。</td>
        </tr>
        <tr>
          <td><code>visible</code></td>
          <td><code>boolean</code></td>
          <td>初始是否可见（列设置）。</td>
        </tr>
        <tr>
          <td><code>children</code></td>
          <td><code>PlusTableColumn[]</code></td>
          <td>多级表头；组节点通常只需 <code>label</code>。</td>
        </tr>
      </DemoApiTable>

      <DemoApiTable title="dependencies">
        <tr>
          <td><code>triggerFields</code></td>
          <td><code>string[]</code></td>
          <td>必填。这些字段变更时跑 <code>trigger</code> 副作用。</td>
        </tr>
        <tr>
          <td><code>disabled</code></td>
          <td><code>(row, api) =&gt; boolean</code></td>
          <td>可选。动态禁用本格编辑。</td>
        </tr>
        <tr>
          <td><code>required</code></td>
          <td><code>(row, api) =&gt; boolean</code></td>
          <td>可选。动态必填。</td>
        </tr>
        <tr>
          <td><code>rules</code></td>
          <td><code>(row, api) =&gt; CellRule[] | null</code></td>
          <td>可选。动态规则，与列静态 rules 合并。</td>
        </tr>
        <tr>
          <td><code>componentProps</code></td>
          <td><code>(row, api) =&gt; Record</code></td>
          <td>可选。动态编辑器 props（如下拉 options）。</td>
        </tr>
        <tr>
          <td><code>trigger</code></td>
          <td><code>(row, api) =&gt; void</code></td>
          <td>
            可选。副作用；用
            <code>api.setValue(prop, value)</code> 改同行其他字段。
          </td>
        </tr>
      </DemoApiTable>
    </template>
  </DemoPage>
</template>
