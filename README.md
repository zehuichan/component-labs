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
├── docs/superpowers/         # 设计规格与实现计划
├── scripts/
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

从 `@/composables` 按需导出，主要包括：

| 模块            | 用途                                   |
| --------------- | -------------------------------------- |
| `useEmitEffect` | 单据草稿：表头变更驱动明细副作用与汇总 |
| `useAutoSave`   | 表单自动保存                           |
| `useFormDraft`  | 表单草稿持久化                         |
| `useSaveHotkey` | 保存快捷键注册                         |
| `useOauth2`     | OAuth2 授权流程                        |
| `useQrconnect`  | 微信扫码登录（含回调）                 |
| `useWechat`     | 微信相关封装                           |
| `useWecom`      | 企业微信 JSSDK                         |
