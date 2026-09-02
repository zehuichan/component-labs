/** table 模式给每个可编辑格常驻一个编辑器实例，超过这个量级基本必然卡顿。 */
export const TABLE_MODE_EDITOR_LIMIT = 2000;

/** 撤销重做栈上限（组件内部常量，不对外暴露） */
export const HISTORY_STACK_LIMIT = 50;

/** 列设置 localStorage key 前缀，后接 props.id */
export const SETTINGS_STORAGE_PREFIX = 'plus-table:settings:';

/** 归一化列树的虚拟根 id，列设置排序表以它作顶层 parentId */
export const ROOT_ID = '__root';

/** 由 el-table 原生渲染的特殊列，不接管 default / header 插槽 */
export const NATIVE_RENDER_COLUMN_TYPES = ['selection', 'index', 'expand'] as const;

/** 不绑定行字段、不参与列设置的特殊列 */
export const SPECIAL_COLUMN_TYPES = [...NATIVE_RENDER_COLUMN_TYPES, 'operation'] as const;

/** 全表校验的并发上限：行之间互不依赖，串行只会把 IO 型规则的耗时线性叠加 */
export const VALIDATE_ROW_CONCURRENCY = 4;

/** 单行重校验被更新的输入连续抢占的次数上限，超过即放弃重试，避免死循环 */
export const MAX_STALE_RETRIES = 5;

/** adaptive 视口模式：表格底部到视口底部预留的间距 */
export const ADAPTIVE_DEFAULT_OFFSET_BOTTOM = 16;

/** adaptive 视口模式：计算出的最小高度 */
export const ADAPTIVE_DEFAULT_MIN_HEIGHT = 200;
