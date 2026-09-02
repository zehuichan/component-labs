import { cloneDeep, isEqual, isPlainObject } from 'es-toolkit';

export type MaybePromise<T> = T | Promise<T>;

/** Returning `undefined` keeps the field's current value. */
export type Resolver<Ctx, V> = (ctx: Ctx) => MaybePromise<V | undefined>;

/** Always follows the formula; user edits are overwritten. */
export interface ComputeRule<Ctx, V> {
  compute: Resolver<Ctx, V>;
  confirm?: boolean;
}

/** Suggested value the user may override; re-derived when a same-level dependency changes. */
export interface DefaultRule<Ctx, V> {
  default: Resolver<Ctx, V>;
  confirm?: boolean;
}

/** A bare function is shorthand for `{ compute }`. */
export type FieldRule<Ctx, V> = Resolver<Ctx, V> | ComputeRule<Ctx, V> | DefaultRule<Ctx, V>;

export interface FormCtx<F> {
  form: F;
}

export interface RowCtx<F, R> extends FormCtx<F> {
  row: R;
  rows: R[];
}

export type RowRules<F, R> = {
  [P in keyof R]?: FieldRule<RowCtx<F, R>, R[P]>;
};

/**
 * Rules mirror the form: a field holding an array of objects takes a row-rule table,
 * every other field takes a header rule.
 */
export type EmitEffectRules<F> = {
  [K in keyof F]?: NonNullable<F[K]> extends (infer R)[]
    ? R extends object
      ? RowRules<F, R>
      : FieldRule<FormCtx<F>, F[K]>
    : FieldRule<FormCtx<F>, F[K]>;
};

export function defineEmitRules<F extends object>(rules: EmitEffectRules<F>): EmitEffectRules<F> {
  return rules;
}

/** Header field (`{ field }`) or row field (`{ entity, rowId, field }`). */
export interface FieldRef {
  entity?: string;
  rowId?: string;
  field: string;
}

export interface FieldChange extends FieldRef {
  value: unknown;
}

/** Built once per propagation when a header change makes `confirm` rules rewrite values. */
export interface EmitEffectConfirmation {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  /** Nodes with `confirm: true` whose value changed. */
  affected: FieldRef[];
  /** Nodes with `confirm: true` kept because they were manually set. */
  preservedCount: number;
}

export interface ResolvedRule {
  kind: 'compute' | 'default';
  run: Resolver<unknown, unknown>;
  confirm: boolean;
}

export interface ManualLookup {
  has: (ref: FieldRef) => boolean;
}

export interface HeaderTrigger {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface PropagateOptions {
  /** Current form values; never mutated. */
  form: object;
  /** Stable row ids per entity, aligned with the array indexes. */
  rowIds: Record<string, string[]>;
  manual: ManualLookup;
  /** Dependency keys changed since the last propagation (see `headerKey` / `rowFieldKey` / `entityKey`). */
  dirty?: Iterable<string>;
  /** Fields the user edited this round; their `default` rules are not re-derived. */
  triggers?: FieldRef[];
  /** Set when exactly one header field changed; enables confirmation collection. */
  headerTrigger?: HeaderTrigger;
  /** Nodes to re-derive regardless of manual state (restore). */
  force?: FieldRef[];
  /** Treat every node as never run (normalize / hydrate). */
  all?: boolean;
  /** Record dependencies only; emit no changes. */
  dryRun?: boolean;
}

export interface PropagateResult {
  changes: FieldChange[];
  /** Manual marks invalidated because a same-level dependency changed. */
  clearedManual: FieldRef[];
  confirmation?: EmitEffectConfirmation;
}

export interface EmitEngine {
  /** Fields whose rule is a row-rule table. */
  entities: string[];
  ruleOf: (ref: FieldRef) => ResolvedRule | undefined;
  propagate: (options: PropagateOptions) => Promise<PropagateResult>;
  /** Forget every recorded dependency (hydrate). */
  reset: () => void;
}

const SEP = '\u001f';
export const MAX_ROUNDS = 20;

export const headerKey = (field: string): string => field;
export const entityKey = (entity: string): string => entity;
export const rowFieldKey = (entity: string, rowId: string, field: string): string =>
  `${entity}${SEP}${rowId}${SEP}${field}`;

export function refKey(ref: FieldRef): string {
  return ref.entity !== undefined
    ? rowFieldKey(ref.entity, ref.rowId ?? '', ref.field)
    : headerKey(ref.field);
}

export function resolveRule(rule: unknown): ResolvedRule | undefined {
  if (typeof rule === 'function') {
    return { kind: 'compute', run: rule as Resolver<unknown, unknown>, confirm: false };
  }
  if (!isPlainObject(rule)) return undefined;
  const candidate = rule as Record<string, unknown>;
  const hasCompute = typeof candidate.compute === 'function';
  const hasDefault = typeof candidate.default === 'function';
  if (hasCompute === hasDefault) return undefined;
  const extraKeys = Object.keys(candidate).filter(
    (key) => key !== 'compute' && key !== 'default' && key !== 'confirm',
  );
  if (extraKeys.length > 0) return undefined;
  return {
    kind: hasCompute ? 'compute' : 'default',
    run: (hasCompute ? candidate.compute : candidate.default) as Resolver<unknown, unknown>,
    confirm: candidate.confirm === true,
  };
}

/** A plain object that is not itself a field rule is a row-rule table. */
export function isRowRules(rule: unknown): boolean {
  return isPlainObject(rule) && resolveRule(rule) === undefined;
}

/** Entities = fields carrying row rules, plus any field holding an array of plain objects. */
export function detectEntities(form: object, rules: object): Set<string> {
  const entities = new Set<string>();
  for (const [field, rule] of Object.entries(rules)) {
    if (isRowRules(rule)) entities.add(field);
  }
  for (const [field, value] of Object.entries(form)) {
    if (Array.isArray(value) && value.every(isPlainObject)) entities.add(field);
  }
  return entities;
}

export function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

interface Node {
  key: string;
  ref: FieldRef;
  rule: ResolvedRule;
  entity?: string;
  rowId?: string;
  index?: number;
}

type Plan = 'skip' | 'dry' | 'write';

function rejectWrite(): never {
  throw new Error('[useEmitEffect] 规则函数不能直接写字段，请通过返回值给出结果。');
}

interface Tracker {
  form: Record<string, unknown>;
  rows: (entity: string) => unknown[];
  row: (entity: string, index: number) => Record<string, unknown>;
}

function createTracker(
  snapshot: Record<string, unknown>,
  rowIds: Record<string, string[]>,
  entities: Set<string>,
  record: (key: string) => void,
): Tracker {
  const rowProxies = new Map<string, Record<string, unknown>>();
  const arrayProxies = new Map<string, unknown[]>();

  const row = (entity: string, index: number): Record<string, unknown> => {
    const cacheKey = `${entity}${SEP}${index}`;
    const cached = rowProxies.get(cacheKey);
    if (cached) return cached;
    const list = snapshot[entity];
    const target = (Array.isArray(list) ? list[index] : undefined) as Record<string, unknown>;
    const rowId = rowIds[entity]?.[index] ?? String(index);
    const proxy = new Proxy(target, {
      get(obj, prop, receiver) {
        if (typeof prop === 'symbol') return Reflect.get(obj, prop, receiver);
        record(rowFieldKey(entity, rowId, prop));
        return Reflect.get(obj, prop, receiver);
      },
      set: rejectWrite,
      deleteProperty: rejectWrite,
    });
    rowProxies.set(cacheKey, proxy);
    return proxy;
  };

  const rows = (entity: string): unknown[] => {
    const cached = arrayProxies.get(entity);
    if (cached) return cached;
    const list = snapshot[entity];
    const target = Array.isArray(list) ? list : [];
    const proxy = new Proxy(target, {
      get(arr, prop, receiver) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const index = Number(prop);
          return isPlainObject(arr[index]) ? row(entity, index) : Reflect.get(arr, prop, receiver);
        }
        return Reflect.get(arr, prop, receiver);
      },
      set: rejectWrite,
      deleteProperty: rejectWrite,
    });
    arrayProxies.set(entity, proxy);
    return proxy;
  };

  const form = new Proxy(snapshot, {
    get(obj, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(obj, prop, receiver);
      if (entities.has(prop)) {
        record(entityKey(prop));
        return rows(prop);
      }
      record(headerKey(prop));
      return Reflect.get(obj, prop, receiver);
    },
    set: rejectWrite,
    deleteProperty: rejectWrite,
  });

  return { form, rows, row };
}

function readNode(snapshot: Record<string, unknown>, node: Node): unknown {
  if (node.entity === undefined) return snapshot[node.ref.field];
  const list = snapshot[node.entity] as Record<string, unknown>[];
  return list[node.index!]?.[node.ref.field];
}

function writeNode(snapshot: Record<string, unknown>, node: Node, value: unknown): void {
  if (node.entity === undefined) {
    snapshot[node.ref.field] = value;
    return;
  }
  const list = snapshot[node.entity] as Record<string, unknown>[];
  list[node.index!]![node.ref.field] = value;
}

/**
 * Creates a propagation engine for a rule table.
 *
 * Dependencies are recorded while a rule runs (Proxy reads), so a node re-runs
 * only when something it actually read changed. Propagation iterates to a fixpoint.
 *
 * @param rules Rule table shaped like the form.
 *
 * @example
 * const engine = createEmitEngine(rules)
 * const { changes } = await engine.propagate({ form, rowIds, manual, dirty: [headerKey('currency')] })
 */
export function createEmitEngine<F extends object>(rules: EmitEffectRules<F>): EmitEngine {
  const ruleTable = rules as Record<string, unknown>;
  const deps = new Map<string, Set<string>>();
  const entities = Object.keys(ruleTable).filter((field) => isRowRules(ruleTable[field]));

  function ruleOf(ref: FieldRef): ResolvedRule | undefined {
    if (ref.entity === undefined) {
      return isRowRules(ruleTable[ref.field]) ? undefined : resolveRule(ruleTable[ref.field]);
    }
    const table = ruleTable[ref.entity];
    if (!isRowRules(table)) return undefined;
    return resolveRule((table as Record<string, unknown>)[ref.field]);
  }

  function buildNodes(snapshot: Record<string, unknown>, rowIds: Record<string, string[]>): Node[] {
    const nodes: Node[] = [];
    for (const field of Object.keys(ruleTable)) {
      const rule = ruleTable[field];
      if (isRowRules(rule)) {
        const list = snapshot[field];
        if (!Array.isArray(list)) continue;
        const table = rule as Record<string, unknown>;
        const fieldRules = Object.keys(table)
          .map((rowField) => [rowField, resolveRule(table[rowField])] as const)
          .filter((entry): entry is readonly [string, ResolvedRule] => entry[1] !== undefined);
        list.forEach((_row, index) => {
          const rowId = rowIds[field]?.[index] ?? String(index);
          for (const [rowField, resolved] of fieldRules) {
            const ref: FieldRef = { entity: field, rowId, field: rowField };
            nodes.push({ key: refKey(ref), ref, rule: resolved, entity: field, rowId, index });
          }
        });
        continue;
      }
      const resolved = resolveRule(rule);
      if (!resolved) continue;
      const ref: FieldRef = { field };
      nodes.push({ key: refKey(ref), ref, rule: resolved });
    }
    return nodes;
  }

  function pruneDeps(nodes: Node[]): void {
    const live = new Set(nodes.map((node) => node.key));
    for (const key of deps.keys()) {
      if (!live.has(key)) deps.delete(key);
    }
  }

  /**
   * Level a change originates from: the header, one row, or an entity's row structure.
   * A manual default is only invalidated by changes whose origin is its own level.
   */
  function originOfKey(key: string, entitySet: Set<string>): string {
    const first = key.indexOf(SEP);
    if (first >= 0) {
      const second = key.indexOf(SEP, first + 1);
      return second >= 0 ? key.slice(0, second) : key;
    }
    return entitySet.has(key) ? `#entity${SEP}${key}` : '#header';
  }

  function levelOf(node: Node): string {
    return node.entity === undefined ? '#header' : `${node.entity}${SEP}${node.rowId}`;
  }

  function addDirty(dirty: Map<string, Set<string>>, key: string, origins: Iterable<string>): void {
    let set = dirty.get(key);
    if (!set) {
      set = new Set();
      dirty.set(key, set);
    }
    for (const origin of origins) set.add(origin);
  }

  async function propagate(options: PropagateOptions): Promise<PropagateResult> {
    const snapshot = cloneDeep(options.form) as Record<string, unknown>;
    const entitySet = detectEntities(snapshot, ruleTable);
    const nodes = buildNodes(snapshot, options.rowIds);
    pruneDeps(nodes);

    const triggers = new Set((options.triggers ?? []).map(refKey));
    const force = new Set((options.force ?? []).map(refKey));
    const collectConfirm = options.headerTrigger !== undefined && !options.dryRun;
    let dirty = new Map<string, Set<string>>();
    for (const key of options.dirty ?? []) addDirty(dirty, key, [originOfKey(key, entitySet)]);

    const changes = new Map<string, FieldChange>();
    const clearedManual: FieldRef[] = [];
    const cleared = new Set<string>();
    const affected = new Map<string, FieldRef>();
    let preservedCount = 0;

    const decide = (node: Node, hitOrigins: Set<string>): Plan => {
      if (options.dryRun) return 'dry';
      if (node.rule.kind === 'compute') return 'write';
      if (triggers.has(node.key)) return 'skip';
      if (force.has(node.key)) return 'write';
      const recorded = deps.get(node.key);
      // First sight of a default field: fill it only when empty, otherwise just learn its dependencies.
      if (!recorded || options.all) {
        return isEmptyValue(readNode(snapshot, node)) ? 'write' : 'dry';
      }
      if (options.manual.has(node.ref) && !cleared.has(node.key)) {
        if (!hitOrigins.has(levelOf(node))) {
          if (node.rule.confirm && collectConfirm) preservedCount += 1;
          return 'skip';
        }
        cleared.add(node.key);
        clearedManual.push(node.ref);
      }
      return 'write';
    };

    let round = 0;
    for (; round < MAX_ROUNDS; round++) {
      const eligible = nodes.filter((node) => {
        if (options.all || force.has(node.key)) return true;
        const recorded = deps.get(node.key);
        if (!recorded) return true;
        if (round === 0 && node.rule.kind === 'compute' && triggers.has(node.key)) return true;
        for (const key of recorded) if (dirty.has(key)) return true;
        return false;
      });
      if (eligible.length === 0) break;

      const nextDirty = new Map<string, Set<string>>();
      const pending: Promise<void>[] = [];

      for (const node of eligible) {
        const hitOrigins = new Set<string>();
        for (const key of deps.get(node.key) ?? []) {
          for (const origin of dirty.get(key) ?? []) hitOrigins.add(origin);
        }
        // Nodes that run for structural reasons (new row, force, normalize) originate at their own level.
        if (hitOrigins.size === 0) hitOrigins.add(levelOf(node));

        const plan = decide(node, hitOrigins);
        if (plan === 'skip') continue;

        const reads = new Set<string>();
        const tracker = createTracker(snapshot, options.rowIds, entitySet, (key) => reads.add(key));
        const ctx =
          node.entity === undefined
            ? { form: tracker.form }
            : {
                form: tracker.form,
                row: tracker.row(node.entity, node.index!),
                rows: tracker.rows(node.entity),
              };

        const finish = (value: unknown): void => {
          deps.set(node.key, reads);
          if (plan === 'dry' || value === undefined) return;
          if (isEqual(readNode(snapshot, node), value)) return;
          writeNode(snapshot, node, value);
          changes.set(node.key, { ...node.ref, value });
          addDirty(nextDirty, node.key, hitOrigins);
          if (node.rule.confirm && collectConfirm) affected.set(node.key, node.ref);
        };

        let output: unknown;
        try {
          output = node.rule.run(ctx);
        } catch (error) {
          throw ruleError(node, error);
        }
        if (output instanceof Promise) {
          pending.push(
            output.then(finish, (error: unknown) => {
              throw ruleError(node, error);
            }),
          );
        } else {
          finish(output);
        }
      }

      await Promise.all(pending);
      dirty = nextDirty;
      // Forced / never-run nodes were satisfied in this round; later rounds follow dirtiness only.
      force.clear();
      if (options.all || options.dryRun) {
        options = { ...options, all: false };
        if (options.dryRun) break;
      }
    }

    if (round >= MAX_ROUNDS) {
      throw new Error(
        `[useEmitEffect] 规则在 ${MAX_ROUNDS} 轮内未收敛，可能存在循环依赖：${[...dirty.keys()].join(', ')}`,
      );
    }

    const result: PropagateResult = { changes: [...changes.values()], clearedManual };
    if (collectConfirm && affected.size > 0) {
      result.confirmation = {
        ...options.headerTrigger!,
        affected: [...affected.values()],
        preservedCount,
      };
    }
    return result;
  }

  return {
    entities,
    ruleOf,
    propagate,
    reset: () => deps.clear(),
  };
}

function describe(node: Node): string {
  return node.entity === undefined
    ? node.ref.field
    : `${node.entity}[${node.rowId}].${node.ref.field}`;
}

function ruleError(node: Node, cause: unknown): Error {
  const reason = cause instanceof Error ? cause.message : String(cause);
  return new Error(`[useEmitEffect] 规则 ${describe(node)} 执行失败：${reason}`, { cause });
}
