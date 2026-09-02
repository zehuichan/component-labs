import {
  isRef,
  reactive,
  readonly,
  shallowRef,
  toRaw,
  toValue,
  watch,
  type MaybeRef,
  type Ref,
} from 'vue';
import { tryOnScopeDispose } from '@vueuse/core';
import { cloneDeep, isEqual } from 'es-toolkit';
import {
  createEmitEngine,
  detectEntities,
  entityKey,
  headerKey,
  rowFieldKey,
  type EmitEffectConfirmation,
  type EmitEffectRules,
  type FieldRef,
  type HeaderTrigger,
  type MaybePromise,
  type PropagateOptions,
  type PropagateResult,
} from './emit-effect';

export interface UseEmitEffectOptions {
  /** Asked once when a header change makes `confirm` rules rewrite values; `false` rolls the header field back. */
  confirm?: (confirmation: EmitEffectConfirmation) => MaybePromise<boolean>;
  /** Value equality used to detect edits; defaults to numeric-aware deep equality. */
  equals?: (a: unknown, b: unknown) => boolean;
  /** Run `normalize()` right after attaching (new documents / demos). */
  immediate?: boolean;
  /** Receives propagation failures raised by form edits. */
  onError?: (error: unknown) => void;
}

/** Header field name, or `[row, field]` for a row field. */
export type ManualTarget<F> = keyof F | [row: object, field: string];

export interface UseEmitEffectReturn<F extends object> {
  /** Whether a propagation is running or queued. */
  pending: Readonly<Ref<boolean>>;
  /** Whether the field holds a value the user typed over its default rule. */
  isManual: (target: ManualTarget<F>) => boolean;
  /** Drops the manual mark and re-derives the field from its rule. */
  restore: (target: ManualTarget<F>) => Promise<void>;
  /** Recomputes every `compute` field and fills empty `default` fields. */
  normalize: () => Promise<void>;
  /** Runs `load` with linkage paused, then rebuilds the baseline without rewriting any value. */
  hydrate: (load: () => MaybePromise<void>) => Promise<void>;
}

interface EntityBaseline {
  rows: object[];
  values: Map<object, Record<string, unknown>>;
}

interface Baseline {
  root: object;
  header: Map<string, unknown>;
  entities: Map<string, EntityBaseline>;
}

interface Job {
  /** Baseline generation the job was queued against; stale jobs are dropped. */
  generation: number;
  dirty: string[];
  triggers: FieldRef[];
  headerTrigger?: HeaderTrigger;
  /** Manual marks added by this edit; undone when the confirmation is rejected. */
  marked: FieldRef[];
  force?: FieldRef[];
  all?: boolean;
  dryRun?: boolean;
}

function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isNaN(value);
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value));
}

/** `1023` and `"1023"` are the same edit; el-input rewrites numbers as strings. */
export function defaultEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (isNumeric(a) && isNumeric(b)) return Number(a) === Number(b);
  return isEqual(a, b);
}

/**
 * Attaches field linkage rules to an existing form.
 *
 * The form stays the single source of truth: bind it with `v-model` / `:data`,
 * mutate it with plain assignments, `push` and `splice`. Replacing `form.value`
 * counts as loading a document and rewrites nothing.
 *
 * @param form Reactive form (a `ref` or `reactive` object) shaped like the DTO.
 * @param rules Rule table shaped like the form.
 *
 * @example
 * const form = ref({ ...defaultForm })
 * const { normalize } = useEmitEffect(form, orderRules, { confirm })
 * const getDetail = async () => { form.value = (await getOrder(id)).data }
 */
export function useEmitEffect<F extends object>(
  form: MaybeRef<F>,
  rules: EmitEffectRules<F>,
  options: UseEmitEffectOptions = {},
): UseEmitEffectReturn<F> {
  const {
    confirm,
    equals = defaultEquals,
    immediate = false,
    onError = (error: unknown) => console.error(error),
  } = options;

  const engine = createEmitEngine(rules);
  const pending = shallowRef(false);

  const rowIds = new WeakMap<object, string>();
  let rowSeq = 0;
  const idOf = (row: object): string => {
    let id = rowIds.get(row);
    if (!id) {
      id = `r${++rowSeq}`;
      rowIds.set(row, id);
    }
    return id;
  };

  const manualHeader = new Set<string>();
  let manualRows = new WeakMap<object, Set<string>>();
  // Bumped on every mark change so templates calling `isManual` re-render without reactive collections.
  const manualVersion = shallowRef(0);
  const touchManual = (): void => {
    manualVersion.value += 1;
  };

  const getReactiveRoot = (): Record<string, unknown> =>
    toValue(form) as unknown as Record<string, unknown>;
  const getRoot = (): Record<string, unknown> => toRaw(getReactiveRoot());

  let baseline: Baseline = { root: {}, header: new Map(), entities: new Map() };
  let generation = 0;

  function rawRows(root: Record<string, unknown>, entity: string): object[] {
    const list = root[entity];
    return Array.isArray(list) ? list.map((row) => toRaw(row) as object) : [];
  }

  function snapshotRow(row: object): Record<string, unknown> {
    return cloneDeep(row) as Record<string, unknown>;
  }

  function buildBaseline(root: Record<string, unknown>): Baseline {
    const entities = detectEntities(root, rules);
    const header = new Map<string, unknown>();
    for (const [field, value] of Object.entries(root)) {
      if (!entities.has(field)) header.set(field, cloneDeep(value));
    }
    const entityBaselines = new Map<string, EntityBaseline>();
    for (const entity of entities) {
      const rows = rawRows(root, entity);
      const values = new Map<object, Record<string, unknown>>();
      for (const row of rows) {
        idOf(row);
        values.set(row, snapshotRow(row));
      }
      entityBaselines.set(entity, { rows, values });
    }
    return { root, header, entities: entityBaselines };
  }

  // ---- manual marks ----

  function findEntity(root: Record<string, unknown>, row: object): string | undefined {
    for (const entity of detectEntities(root, rules)) {
      if (rawRows(root, entity).includes(row)) return entity;
    }
    return undefined;
  }

  function toRef(target: ManualTarget<F>): FieldRef | undefined {
    if (Array.isArray(target)) {
      const row = toRaw(target[0]);
      const entity = findEntity(getRoot(), row);
      return entity === undefined ? undefined : { entity, rowId: idOf(row), field: target[1] };
    }
    return { field: String(target) };
  }

  function rowOf(ref: FieldRef, rowsById: Map<string, object>): object | undefined {
    return ref.rowId === undefined ? undefined : rowsById.get(ref.rowId);
  }

  function markManual(ref: FieldRef, rowsById: Map<string, object>): void {
    if (ref.entity === undefined) {
      manualHeader.add(ref.field);
      touchManual();
      return;
    }
    const row = rowOf(ref, rowsById);
    if (!row) return;
    let fields = manualRows.get(row);
    if (!fields) {
      fields = new Set();
      manualRows.set(row, fields);
    }
    fields.add(ref.field);
    touchManual();
  }

  function unmarkManual(ref: FieldRef, rowsById: Map<string, object>): void {
    if (ref.entity === undefined) {
      manualHeader.delete(ref.field);
    } else {
      const row = rowOf(ref, rowsById);
      if (row) manualRows.get(row)?.delete(ref.field);
    }
    touchManual();
  }

  function collectRows(root: Record<string, unknown>): {
    ids: Record<string, string[]>;
    byId: Map<string, object>;
  } {
    const ids: Record<string, string[]> = {};
    const byId = new Map<string, object>();
    for (const entity of detectEntities(root, rules)) {
      ids[entity] = rawRows(root, entity).map((row) => {
        const id = idOf(row);
        byId.set(id, row);
        return id;
      });
    }
    return { ids, byId };
  }

  // ---- change detection ----

  let applying = 0;

  interface Diff {
    dirty: Set<string>;
    triggers: FieldRef[];
    headerChanges: HeaderTrigger[];
    structural: boolean;
  }

  function diff(root: Record<string, unknown>): Diff {
    const entities = detectEntities(root, rules);
    const dirty = new Set<string>();
    const triggers: FieldRef[] = [];
    const headerChanges: HeaderTrigger[] = [];
    let structural = false;

    const headerFields = new Set([...baseline.header.keys(), ...Object.keys(root)]);
    for (const field of headerFields) {
      if (entities.has(field)) continue;
      const previous = baseline.header.get(field);
      const current = root[field];
      if (equals(previous, current)) continue;
      dirty.add(headerKey(field));
      triggers.push({ field });
      headerChanges.push({ field, oldValue: previous, newValue: current });
    }

    for (const entity of entities) {
      const previous = baseline.entities.get(entity);
      const rows = rawRows(root, entity);
      if (
        !previous ||
        previous.rows.length !== rows.length ||
        previous.rows.some((row, index) => row !== rows[index])
      ) {
        dirty.add(entityKey(entity));
        structural = true;
      }
      for (const row of rows) {
        const snapshot = previous?.values.get(row);
        if (!snapshot) continue;
        const rowId = idOf(row);
        const fields = new Set([...Object.keys(snapshot), ...Object.keys(row)]);
        for (const field of fields) {
          if (equals(snapshot[field], (row as Record<string, unknown>)[field])) continue;
          dirty.add(rowFieldKey(entity, rowId, field));
          triggers.push({ entity, rowId, field });
        }
      }
    }

    return { dirty, triggers, headerChanges, structural };
  }

  // ---- queue ----

  let tail: Promise<void> = Promise.resolve();
  let depth = 0;

  function enqueue(job: Omit<Job, 'generation'>): Promise<void> {
    depth += 1;
    pending.value = true;
    const queued: Job = { ...job, generation };
    const run = tail.then(() => runJob(queued));
    tail = run.catch(() => undefined);
    return run.finally(() => {
      depth -= 1;
      if (depth === 0) pending.value = false;
    });
  }

  async function runJob(job: Job): Promise<void> {
    // The form was replaced after this edit was queued; the hydrate that follows owns the new baseline.
    if (job.generation !== generation) return;
    const root = getRoot();
    const { ids, byId } = collectRows(root);
    const request: PropagateOptions = {
      form: root,
      rowIds: ids,
      manual: {
        has: (ref) => {
          if (ref.entity === undefined) return manualHeader.has(ref.field);
          const row = rowOf(ref, byId);
          return row ? (manualRows.get(row)?.has(ref.field) ?? false) : false;
        },
      },
      dirty: job.dirty,
      triggers: job.triggers,
      headerTrigger: job.headerTrigger,
      force: job.force,
      all: job.all,
      dryRun: job.dryRun,
    };
    const result = await engine.propagate(request);

    if (result.confirmation && confirm) {
      const accepted = await confirm(result.confirmation);
      if (!accepted) {
        rollback(job, byId);
        return;
      }
    }
    apply(result, byId);
  }

  function writeHeader(field: string, value: unknown): void {
    getReactiveRoot()[field] = value;
    baseline.header.set(field, cloneDeep(value));
  }

  function writeRow(entity: string, row: object, field: string, value: unknown): void {
    (reactive(row) as Record<string, unknown>)[field] = value;
    const snapshot = baseline.entities.get(entity)?.values.get(row);
    if (snapshot) snapshot[field] = cloneDeep(value);
  }

  function apply(result: PropagateResult, byId: Map<string, object>): void {
    applying += 1;
    try {
      for (const change of result.changes) {
        if (change.entity === undefined) {
          writeHeader(change.field, change.value);
          continue;
        }
        const row = rowOf(change, byId);
        if (row) writeRow(change.entity, row, change.field, change.value);
      }
      for (const ref of result.clearedManual) unmarkManual(ref, byId);
    } finally {
      applying -= 1;
    }
  }

  function rollback(job: Job, byId: Map<string, object>): void {
    applying += 1;
    try {
      if (job.headerTrigger) writeHeader(job.headerTrigger.field, job.headerTrigger.oldValue);
      for (const ref of job.marked) unmarkManual(ref, byId);
    } finally {
      applying -= 1;
    }
  }

  // ---- hydrate ----

  function rebase(): Promise<void> {
    const root = getRoot();
    generation += 1;
    engine.reset();
    manualHeader.clear();
    manualRows = new WeakMap();
    touchManual();
    baseline = buildBaseline(root);
    return enqueue({ dirty: [], triggers: [], marked: [], all: true, dryRun: true });
  }

  function onFormChange(): void {
    if (applying > 0) return;
    const root = getRoot();
    if (root !== baseline.root) {
      void rebase().catch(onError);
      return;
    }

    const changes = diff(root);
    if (changes.dirty.size === 0) return;

    const { byId } = collectRows(root);
    const marked: FieldRef[] = [];
    for (const ref of changes.triggers) {
      const rule = engine.ruleOf(ref);
      if (!rule) continue;
      if (rule.kind === 'default') {
        markManual(ref, byId);
        marked.push(ref);
      } else if (import.meta.env.DEV) {
        console.warn(
          `[useEmitEffect] 字段 ${ref.entity ? `${ref.entity}.` : ''}${ref.field} 是 compute 规则，人工输入会被重算覆盖。`,
        );
      }
    }
    baseline = buildBaseline(root);

    const headerTrigger =
      changes.headerChanges.length === 1 && changes.triggers.length === 1 && !changes.structural
        ? changes.headerChanges[0]
        : undefined;

    void enqueue({
      dirty: [...changes.dirty],
      triggers: changes.triggers,
      headerTrigger,
      marked,
    }).catch(onError);
  }

  const stop = watch(() => toValue(form), onFormChange, { deep: true, flush: 'sync' });
  tryOnScopeDispose(stop);

  // ---- public API ----

  const initial = rebase();
  if (immediate) {
    void initial.then(() => normalize()).catch(onError);
  } else {
    void initial.catch(onError);
  }

  function isManual(target: ManualTarget<F>): boolean {
    void manualVersion.value;
    if (Array.isArray(target)) {
      return manualRows.get(toRaw(target[0]))?.has(target[1]) ?? false;
    }
    return manualHeader.has(String(target));
  }

  function restore(target: ManualTarget<F>): Promise<void> {
    const ref = toRef(target);
    if (!ref) return Promise.resolve();
    if (ref.entity === undefined) {
      manualHeader.delete(ref.field);
    } else {
      manualRows.get(toRaw((target as [object, string])[0]))?.delete(ref.field);
    }
    touchManual();
    return enqueue({ dirty: [], triggers: [], marked: [], force: [ref] });
  }

  function normalize(): Promise<void> {
    return enqueue({ dirty: [], triggers: [], marked: [], all: true });
  }

  async function hydrate(load: () => MaybePromise<void>): Promise<void> {
    applying += 1;
    try {
      await load();
    } finally {
      applying -= 1;
    }
    await rebase();
  }

  return {
    pending: readonly(pending),
    isManual,
    restore,
    normalize,
    hydrate,
  };
}
