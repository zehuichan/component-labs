# Workbench

<p align="left">
  <img src="docs/brand/logo.svg" alt="Workbench" height="48" />
</p>

面向复杂业务数据录入与字段联动的 Vue 前端工作台。基于 **Vue 3 + TypeScript + Vite 8**，当前核心包括增强表格 **PlusTable**、表单 Composables 和 ERP 单据场景。

## 仓库结构

```
workbench/
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── router/
│   ├── layouts/
│   ├── views/plus-table/     # PlusTable 场景 demo
│   ├── views/erp/            # ERP 单据联动 demo（独立完整页）
│   ├── components/plus-table/
│   └── composables/          # 含 useEmitEffect 等可复用引擎
├── docs/superpowers/
├── index.html
├── vite.config.ts
└── package.json
```

## 快速开始

```bash
pnpm install

# 启动开发服务器（默认端口 8000）
pnpm dev
```

## Playground

`pnpm dev` 后访问 http://localhost:8000 。

侧栏切换 PlusTable 场景：

- `/plus-table/basic-editing`
- `/plus-table/dependencies-validation`
- `/plus-table/history-dirty`
- `/plus-table/pagination-rows`
- `/plus-table/adaptive-height`

ERP 单据联动场景（引擎：`useEmitEffect`，`@/composables`；三页为独立完整 demo）：

- `/erp/sales-order-linkage`
- `/erp/purchase-order-linkage`
- `/erp/expense-report-linkage`

Composables：

- `/composables/use-auto-save`
- `/composables/use-form-draft`
- `/composables/use-save-hotkey`

## 常用脚本

| 命令             | 说明                           |
| ---------------- | ------------------------------ |
| `pnpm dev`       | 启动 Vite 开发服务器           |
| `pnpm build`     | 类型检查并构建生产产物         |
| `pnpm preview`   | 预览构建产物                   |
| `pnpm typecheck` | `vue-tsc` 类型检查             |
| `pnpm format`    | 使用 Prettier 格式化           |
| `pnpm clean`     | 清理 `node_modules`、`dist` 等 |
| `pnpm reinstall` | 深度清理后重新安装依赖         |

## PlusTable

组件源码位于 [`src/components/plus-table/`](src/components/plus-table/)。在应用中通过 `@/components/plus-table` 引用：

```ts
import { PlusTable } from '@/components/plus-table';
```

PlusTable 在 `el-table` 之上提供配置式列、多种编辑模式、键盘导航与自定义热键、表级/列级校验、行增删改与撤销重做、列设置、单元格联动、脏数据追踪、分页与自适应高度等能力。
