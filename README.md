# Workbench

<p align="left">
  <img src="brand/logo.svg" alt="Workbench" height="48" />
</p>

面向复杂业务数据录入与字段联动的 Vue 前端工作台。基于 **Vue 3 + TypeScript + Vite 8**，Playground 内可切换 PlusTable、Filters、ERP 单据联动与各类 Composables 演示。设计体系见根目录 [`DESIGN.md`](DESIGN.md)，品牌预览见 [`brand/preview.html`](brand/preview.html)。

要求 **Node.js ≥20.19**、**pnpm ≥10**（`packageManager` 锁定 pnpm 10.33.4）。

## 仓库结构

```
workbench/
├── brand/                    # Logo、预览页
├── src/
│   ├── api/
│   ├── components/
│   │   ├── demo/             # Playground demo 壳（页面 / 代码高亮 / API 表）
│   │   ├── filters/          # 筛选栏 Filters
│   │   └── plus-table/       # 增强表格 PlusTable
│   ├── composables/          # useEmitEffect、表单、微信等
│   ├── layouts/              # Playground 壳（侧栏 / 顶栏）
│   ├── router/
│   ├── styles/               # Tailwind tokens + SCSS
│   ├── ui/                   # shadcn-vue / Reka UI 原语
│   ├── utils/
│   └── views/                # PlusTable / Filters / ERP / Composables demos
├── DESIGN.md
├── index.html
├── vite.config.ts
└── package.json
```

## 快速开始

```bash
pnpm install

# 启动开发服务器（默认端口 9527）
pnpm dev
```

访问 http://localhost:9527 。

## Playground

侧栏按分组切换场景。各模块另有 API Overview 页。

### PlusTable

- `/plus-table/api-overview`
- `/plus-table/basic-editing`
- `/plus-table/dependencies-validation`
- `/plus-table/history-dirty`
- `/plus-table/pagination-rows`
- `/plus-table/adaptive-height`

### Filters

- `/filters/api-overview`
- `/filters/basic`
- `/filters/preset`

### ERP 场景

引擎：`useEmitEffect`（`@/composables`）。三页为独立完整 demo：

- `/erp/api-overview`
- `/erp/sales-order-linkage`
- `/erp/purchase-order-linkage`
- `/erp/expense-report-linkage`

### Form Composables

- `/composables/use-auto-save`
- `/composables/use-form-draft`
- `/composables/use-save-hotkey`
- `/composables/use-sso`

### WeChat Composables

- `/composables/use-oauth2`
- `/composables/use-qrconnect`
- `/composables/use-wechat`
- `/composables/use-wecom`

扫码回调页：`/auth/wechat`（不挂 Playground 壳）。

## 常用脚本

| 命令                | 说明                           |
| ------------------- | ------------------------------ |
| `pnpm dev`          | 启动 Vite 开发服务器           |
| `pnpm build`        | 类型检查并构建生产产物         |
| `pnpm preview`      | 预览构建产物                   |
| `pnpm typecheck`    | `vue-tsc` 类型检查             |
| `pnpm test`         | Vitest（happy-dom）            |
| `pnpm format`       | Prettier 格式化                |
| `pnpm format:check` | Prettier 检查                  |
| `pnpm clean`        | 清理 `node_modules`、`dist` 等 |
| `pnpm reinstall`    | 深度清理后重新安装依赖         |

## PlusTable

组件源码位于 [`src/components/plus-table/`](src/components/plus-table/)。在应用中通过 `@/components/plus-table` 引用：

```ts
import { PlusTable } from '@/components/plus-table';
```

PlusTable 在 `el-table` 之上提供配置式列、多种编辑模式、键盘导航与自定义热键、表级/列级校验、行增删改与撤销重做、列设置、右键菜单、单元格联动、脏数据追踪、分页与自适应高度等能力。

## Filters

组件源码位于 [`src/components/filters/`](src/components/filters/)。通过 `@/components/filters` 引用：

```ts
import { Filters } from '@/components/filters';
```

按 `schema` 配置可选字段，最多 8 个槽位先选字段再填值；字段互斥，值编辑器复用全局组件适配器。

## Composables

签名对齐 [VueUse](https://github.com/vueuse/vueuse)：主参数位置传入，可选配置走末尾 `options`；多值返回对象（不是元组）。约定细则见 [`.cursor/rules/vueuse-composables.mdc`](.cursor/rules/vueuse-composables.mdc)。

从 `@/composables` 按需导出：

```ts
import { useAutoSave, useFormDraft, useSaveHotkey } from '@/composables';

const { restore, flush } = useFormDraft(form, 'workbench:expense-draft');
const { status, flush: saveNow } = useAutoSave(form, (value, signal) =>
  api.saveExpense(value, { signal }),
);
useSaveHotkey(saveNow);
```

| 模块            | 签名（简化）                                             | 用途                         |
| --------------- | -------------------------------------------------------- | ---------------------------- |
| `useEmitEffect` | `(rules, initialDraft, options?)`                        | 表头变更驱动明细副作用与汇总 |
| `useAutoSave`   | `(source, save, options?)` → `{ status, flush, … }`      | 防抖自动保存                 |
| `useFormDraft`  | `(form, key, options?)` → `{ restore, clear, flush, … }` | localStorage 草稿            |
| `useSaveHotkey` | `(handler, options?)`                                    | Ctrl/Cmd+S                   |
| `useOauth2`     | `(options?)` → `{ code, authorize }`                     | 微信网页授权                 |
| `useQrconnect`  | `(options?)` → `{ code, authorize }`                     | 开放平台扫码登录             |
| `useWechat`     | `(options?)` → `{ ready, wx }`                           | 微信 JSSDK                   |
| `useWecom`      | `(options?)` → `{ ready, ww }`                           | 企微 JSSDK                   |

浏览器全局与 AppId / 开关通过 `options` 注入（`window`、`appId`、`enabled`、`mode` 等），`import.meta.env` 只作默认值。hash 路由读回调 `code` 时传 `mode: 'hash'`。

SSO 不是 composable：挂载前显式调用 [`sso()`](src/utils/sso.ts)，不要 `import '@/utils/sso'`。

```ts
import { sso } from '@/utils/sso';

sso();
createApp(App).use(router).mount('#app');
```

### 迁移（破坏性）

| 旧写法                                               | 新写法                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| `useAutoSave({ source, save, debounceMs })`          | `useAutoSave(source, save, { debounceMs })`                       |
| `useFormDraft({ form, key, … })`                     | `useFormDraft(form, key, { … })`                                  |
| `useSaveHotkey({ handler, enabled })`                | `useSaveHotkey(handler, { enabled })`                             |
| `useEmitEffect({ rules, initialDraft, confirm })`    | `useEmitEffect(rules, initialDraft, { confirm })`                 |
| `const [code, authorize] = useOauth2('snsapi_base')` | `const { code, authorize } = useOauth2({ scope: 'snsapi_base' })` |
| `const [ready, $wx] = useWechat()`                   | `const { ready, wx } = useWechat()`                               |
| `const [ready, $ww] = useWecom()`                    | `const { ready, ww } = useWecom()`                                |
| `import '@/utils/sso'`                               | `import { sso } from '@/utils/sso'` 后调用 `sso()`                |
