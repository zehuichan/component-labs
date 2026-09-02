import { describe, expect, it, vi } from 'vitest';
import {
  MAX_ROUNDS,
  createEmitEngine,
  defineEmitRules,
  detectEntities,
  entityKey,
  headerKey,
  refKey,
  rowFieldKey,
  type FieldRef,
  type PropagateOptions,
  type PropagateResult,
} from '../../use-emit-effect/emit-effect';

interface Item {
  id: number;
  productId: string;
  qty: number;
  price: number | null;
  amount: number | null;
}

interface Form {
  currency: string;
  rate: number | null;
  discount: number;
  total: number | null;
  items: Item[];
  files: { name: string }[];
}

const RATES: Record<string, number> = { CNY: 1, USD: 7 };
const PRICES: Record<string, number> = { pen: 10, book: 50 };

const rules = defineEmitRules<Form>({
  rate: { default: ({ form }) => RATES[form.currency] },
  total: ({ form }) => form.items.reduce((sum, item) => sum + (item.amount ?? 0), 0),
  items: {
    price: {
      default: ({ row, form }) => (PRICES[row.productId] ?? 0) * (1 - form.discount),
      confirm: true,
    },
    amount: ({ row }) => row.qty * (row.price ?? 0),
  },
});

function createForm(): Form {
  return {
    currency: 'CNY',
    rate: null,
    discount: 0,
    total: null,
    items: [
      { id: 1, productId: 'pen', qty: 2, price: null, amount: null },
      { id: 2, productId: 'book', qty: 1, price: 45, amount: null },
    ],
    files: [{ name: 'a.pdf' }],
  };
}

function rowIdsOf(form: Form): Record<string, string[]> {
  return {
    items: form.items.map((item) => `row-${item.id}`),
    files: form.files.map((_file, index) => `file-${index}`),
  };
}

interface Harness {
  form: Form;
  manual: Set<string>;
  run: (options?: Partial<PropagateOptions>) => Promise<PropagateResult>;
}

/** Applies each result to the plain form so consecutive runs see the committed state. */
function createHarness(form = createForm(), engineRules = rules): Harness {
  const engine = createEmitEngine(engineRules);
  const manual = new Set<string>();
  const applyChanges = (result: PropagateResult) => {
    for (const change of result.changes) {
      if (change.entity === undefined) {
        (form as unknown as Record<string, unknown>)[change.field] = change.value;
        continue;
      }
      const index = rowIdsOf(form)[change.entity]!.indexOf(change.rowId!);
      const list = (form as unknown as Record<string, Record<string, unknown>[]>)[change.entity]!;
      list[index]![change.field] = change.value;
    }
    for (const ref of result.clearedManual) manual.delete(refKey(ref));
  };
  return {
    form,
    manual,
    run: async (options = {}) => {
      const result = await engine.propagate({
        form,
        rowIds: rowIdsOf(form),
        manual: { has: (ref: FieldRef) => manual.has(refKey(ref)) },
        ...options,
      });
      applyChanges(result);
      return result;
    },
  };
}

describe('emit-effect · rule table', () => {
  it('detects entities from row rules and from arrays of plain objects', () => {
    const entities = detectEntities(createForm(), rules);
    expect([...entities].sort()).toEqual(['files', 'items']);
    expect(createEmitEngine(rules).entities).toEqual(['items']);
  });

  it('resolves header rules, row rules, and rejects unknown refs', () => {
    const engine = createEmitEngine(rules);
    expect(engine.ruleOf({ field: 'rate' })?.kind).toBe('default');
    expect(engine.ruleOf({ field: 'total' })?.kind).toBe('compute');
    expect(engine.ruleOf({ entity: 'items', rowId: 'x', field: 'price' })?.confirm).toBe(true);
    expect(engine.ruleOf({ field: 'currency' })).toBeUndefined();
    expect(engine.ruleOf({ field: 'items' })).toBeUndefined();
  });
});

describe('emit-effect · first pass', () => {
  it('fills compute fields and empty defaults, keeps defaults that already hold a value', async () => {
    const { form, run } = createHarness();
    const result = await run({ all: true });

    expect(form.rate).toBe(1);
    expect(form.items[0]!.price).toBe(10);
    expect(form.items[1]!.price).toBe(45);
    expect(form.items.map((item) => item.amount)).toEqual([20, 45]);
    expect(form.total).toBe(65);
    expect(result.changes.map(refKey)).not.toContain(rowFieldKey('items', 'row-2', 'price'));
  });

  it('learns dependencies in dryRun without emitting changes', async () => {
    const { form, run } = createHarness();
    const dry = await run({ all: true, dryRun: true });
    expect(dry.changes).toEqual([]);
    expect(form.rate).toBeNull();
    expect(form.items[0]!.amount).toBeNull();

    form.currency = 'USD';
    const next = await run({ dirty: [headerKey('currency')] });
    expect(next.changes).toEqual([{ field: 'rate', value: 7 }]);
    expect(form.items[0]!.amount).toBeNull();
  });

  it('re-derives a kept default once one of its dependencies changes', async () => {
    const { form, run } = createHarness();
    await run({ all: true });
    form.discount = 0.5;
    await run({ dirty: [headerKey('discount')] });
    expect(form.items[1]!.price).toBe(25);
    expect(form.items[1]!.amount).toBe(25);
    expect(form.items[0]!.amount).toBe(10);
    expect(form.total).toBe(35);
  });
});

describe('emit-effect · dependency tracking', () => {
  it('records reads that happen after an await', async () => {
    interface AsyncForm {
      a: number;
      b: number;
      out: number | null;
    }
    const engine = createEmitEngine(
      defineEmitRules<AsyncForm>({
        out: async ({ form }) => {
          const a = form.a;
          await Promise.resolve();
          return a + form.b;
        },
      }),
    );
    const form: AsyncForm = { a: 1, b: 2, out: null };
    const base = { form, rowIds: {}, manual: { has: () => false } };
    const first = await engine.propagate({ ...base, all: true });
    expect(first.changes).toEqual([{ field: 'out', value: 3 }]);
    form.out = 3;
    form.b = 5;
    const second = await engine.propagate({ ...base, dirty: [headerKey('b')] });
    expect(second.changes).toEqual([{ field: 'out', value: 6 }]);
  });

  it('re-tracks dependencies when a branch changes what is read', async () => {
    interface BranchForm {
      useB: boolean;
      a: number;
      b: number;
      out: number | null;
    }
    const engine = createEmitEngine(
      defineEmitRules<BranchForm>({
        out: ({ form }) => (form.useB ? form.b : form.a),
      }),
    );
    const form: BranchForm = { useB: false, a: 1, b: 2, out: null };
    const base = { form, rowIds: {}, manual: { has: () => false } };
    await engine.propagate({ ...base, all: true });
    form.out = 1;
    form.b = 9;
    expect((await engine.propagate({ ...base, dirty: [headerKey('b')] })).changes).toEqual([]);
    form.useB = true;
    expect((await engine.propagate({ ...base, dirty: [headerKey('useB')] })).changes).toEqual([
      { field: 'out', value: 9 },
    ]);
    form.out = 9;
    form.b = 4;
    expect((await engine.propagate({ ...base, dirty: [headerKey('b')] })).changes).toEqual([
      { field: 'out', value: 4 },
    ]);
  });

  it('records the entity key when a rule reads the whole array', async () => {
    const { form, run } = createHarness();
    await run({ all: true });
    form.items.push({ id: 3, productId: 'pen', qty: 3, price: null, amount: null });
    await run({ dirty: [entityKey('items')] });
    expect(form.items[2]!.price).toBe(10);
    expect(form.items[2]!.amount).toBe(30);
    expect(form.total).toBe(95);

    form.items.splice(0, 1);
    await run({ dirty: [entityKey('items')] });
    expect(form.total).toBe(75);
  });

  it('keeps the current value when a rule returns undefined', async () => {
    interface KeepForm {
      code: string | null;
      label: string | null;
    }
    const engine = createEmitEngine(
      defineEmitRules<KeepForm>({
        label: ({ form }) => (form.code ? form.code.toUpperCase() : undefined),
      }),
    );
    const form: KeepForm = { code: null, label: 'stale' };
    const result = await engine.propagate({
      form,
      rowIds: {},
      manual: { has: () => false },
      all: true,
    });
    expect(result.changes).toEqual([]);
  });

  it('rejects rules that write into the context', async () => {
    interface BadForm {
      a: number;
      b: number;
    }
    const engine = createEmitEngine(
      defineEmitRules<BadForm>({
        b: ({ form }) => {
          form.a = 2;
          return 1;
        },
      }),
    );
    await expect(
      engine.propagate({
        form: { a: 1, b: 0 },
        rowIds: {},
        manual: { has: () => false },
        all: true,
      }),
    ).rejects.toThrow(/不能直接写字段/);
  });
});

describe('emit-effect · compute vs default', () => {
  it('overwrites user input on compute fields', async () => {
    const { form, run } = createHarness();
    await run({ all: true });
    form.items[0]!.amount = 999;
    const ref: FieldRef = { entity: 'items', rowId: 'row-1', field: 'amount' };
    await run({ dirty: [refKey(ref)], triggers: [ref] });
    expect(form.items[0]!.amount).toBe(20);
  });

  it('keeps a manual default when only a cross-level dependency changed', async () => {
    const { form, manual, run } = createHarness();
    await run({ all: true });
    const priceRef: FieldRef = { entity: 'items', rowId: 'row-2', field: 'price' };
    manual.add(refKey(priceRef));

    form.discount = 0.5;
    const result = await run({
      dirty: [headerKey('discount')],
      triggers: [{ field: 'discount' }],
      headerTrigger: { field: 'discount', oldValue: 0, newValue: 0.5 },
    });
    expect(form.items[1]!.price).toBe(45);
    expect(form.items[0]!.price).toBe(5);
    expect(result.confirmation).toEqual({
      field: 'discount',
      oldValue: 0,
      newValue: 0.5,
      affected: [{ entity: 'items', rowId: 'row-1', field: 'price' }],
      preservedCount: 1,
    });
    expect(result.clearedManual).toEqual([]);
  });

  it('invalidates a manual default when a same-level dependency changed', async () => {
    const { form, manual, run } = createHarness();
    await run({ all: true });
    const priceRef: FieldRef = { entity: 'items', rowId: 'row-2', field: 'price' };
    manual.add(refKey(priceRef));

    form.items[1]!.productId = 'pen';
    const productRef: FieldRef = { entity: 'items', rowId: 'row-2', field: 'productId' };
    const result = await run({ dirty: [refKey(productRef)], triggers: [productRef] });
    expect(result.clearedManual).toEqual([priceRef]);
    expect(manual.has(refKey(priceRef))).toBe(false);
    expect(form.items[1]!.price).toBe(10);
  });

  it('never re-derives the field the user just edited, which makes two-way conversion work', async () => {
    interface FxForm {
      rate: number;
      items: { id: number; fx: number | null; rmb: number | null }[];
    }
    const engine = createEmitEngine(
      defineEmitRules<FxForm>({
        items: {
          rmb: { default: ({ row, form }) => (row.fx === null ? undefined : row.fx * form.rate) },
          fx: { default: ({ row, form }) => (row.rmb === null ? undefined : row.rmb / form.rate) },
        },
      }),
    );
    const form: FxForm = { rate: 7, items: [{ id: 1, fx: 10, rmb: null }] };
    const manual = new Set<string>();
    const base = {
      form,
      rowIds: { items: ['r1'] },
      manual: { has: (ref: FieldRef) => manual.has(refKey(ref)) },
    };
    const first = await engine.propagate({ ...base, all: true });
    expect(first.changes).toEqual([{ entity: 'items', rowId: 'r1', field: 'rmb', value: 70 }]);
    form.items[0]!.rmb = 70;

    form.items[0]!.rmb = 140;
    const rmbRef: FieldRef = { entity: 'items', rowId: 'r1', field: 'rmb' };
    manual.add(refKey(rmbRef));
    const second = await engine.propagate({ ...base, dirty: [refKey(rmbRef)], triggers: [rmbRef] });
    expect(second.changes).toEqual([{ entity: 'items', rowId: 'r1', field: 'fx', value: 20 }]);
    form.items[0]!.fx = 20;

    form.rate = 8;
    const third = await engine.propagate({ ...base, dirty: [headerKey('rate')] });
    expect(third.changes).toEqual([{ entity: 'items', rowId: 'r1', field: 'fx', value: 17.5 }]);
  });

  it('re-derives a forced field even when it is manual', async () => {
    const { form, manual, run } = createHarness();
    await run({ all: true });
    const priceRef: FieldRef = { entity: 'items', rowId: 'row-2', field: 'price' };
    manual.add(refKey(priceRef));
    const result = await run({ force: [priceRef] });
    expect(result.changes).toContainEqual({ ...priceRef, value: 50 });
    expect(form.items[1]!.amount).toBe(50);
    expect(form.total).toBe(70);
  });

  it('does not invalidate a manual value through a chain that started at another level', async () => {
    interface ChainForm {
      rate: number;
      items: { id: number; base: number; derived: number | null; manualFee: number | null }[];
    }
    const engine = createEmitEngine(
      defineEmitRules<ChainForm>({
        items: {
          derived: ({ row, form }) => row.base * form.rate,
          manualFee: { default: ({ row }) => (row.derived ?? 0) / 10 },
        },
      }),
    );
    const form: ChainForm = {
      rate: 2,
      items: [{ id: 1, base: 5, derived: null, manualFee: null }],
    };
    const feeRef: FieldRef = { entity: 'items', rowId: 'r1', field: 'manualFee' };
    const manual = new Set<string>([refKey(feeRef)]);
    const base = {
      form,
      rowIds: { items: ['r1'] },
      manual: { has: (ref: FieldRef) => manual.has(refKey(ref)) },
    };
    await engine.propagate({ ...base, all: true });
    form.items[0]!.derived = 10;
    form.items[0]!.manualFee = 99;

    form.rate = 3;
    const viaHeader = await engine.propagate({ ...base, dirty: [headerKey('rate')] });
    expect(viaHeader.changes).toEqual([
      { entity: 'items', rowId: 'r1', field: 'derived', value: 15 },
    ]);
    expect(viaHeader.clearedManual).toEqual([]);
    form.items[0]!.derived = 15;

    form.items[0]!.base = 7;
    const baseRef: FieldRef = { entity: 'items', rowId: 'r1', field: 'base' };
    const viaRow = await engine.propagate({
      ...base,
      dirty: [refKey(baseRef)],
      triggers: [baseRef],
    });
    expect(viaRow.clearedManual).toEqual([feeRef]);
    expect(viaRow.changes).toEqual([
      { entity: 'items', rowId: 'r1', field: 'derived', value: 21 },
      { ...feeRef, value: 2.1 },
    ]);
  });

  it('collects a confirmation only when a header trigger is supplied', async () => {
    const { form, run } = createHarness();
    await run({ all: true });
    form.discount = 0.2;
    const silent = await run({ dirty: [headerKey('discount')] });
    expect(silent.confirmation).toBeUndefined();
    expect(silent.changes.length).toBeGreaterThan(0);
  });
});

describe('emit-effect · convergence', () => {
  it('returns only paths whose value actually changed', async () => {
    const { run } = createHarness();
    await run({ all: true });
    const again = await run({ all: true });
    expect(again.changes).toEqual([]);
  });

  it('throws when rules never converge', async () => {
    interface LoopForm {
      a: number;
      b: number;
    }
    const engine = createEmitEngine(
      defineEmitRules<LoopForm>({
        a: ({ form }) => form.b + 1,
        b: ({ form }) => form.a + 1,
      }),
    );
    await expect(
      engine.propagate({
        form: { a: 0, b: 0 },
        rowIds: {},
        manual: { has: () => false },
        all: true,
      }),
    ).rejects.toThrow(new RegExp(`${MAX_ROUNDS} 轮`));
  });

  it('runs async row rules of one round in parallel', async () => {
    interface SlowForm {
      items: { id: number; code: string; label: string | null }[];
    }
    const lookup = vi.fn(
      (code: string) =>
        new Promise<string>((resolve) => setTimeout(() => resolve(code.toUpperCase()), 20)),
    );
    const engine = createEmitEngine(
      defineEmitRules<SlowForm>({
        items: { label: ({ row }) => lookup(row.code) },
      }),
    );
    const form: SlowForm = {
      items: [
        { id: 1, code: 'a', label: null },
        { id: 2, code: 'b', label: null },
        { id: 3, code: 'c', label: null },
      ],
    };
    const started = Date.now();
    const result = await engine.propagate({
      form,
      rowIds: { items: ['1', '2', '3'] },
      manual: { has: () => false },
      all: true,
    });
    expect(Date.now() - started).toBeLessThan(55);
    expect(lookup).toHaveBeenCalledTimes(3);
    expect(result.changes.map((change) => change.value)).toEqual(['A', 'B', 'C']);
  });

  it('wraps rule failures with the node description', async () => {
    interface FailForm {
      items: { id: number; x: number }[];
    }
    const engine = createEmitEngine(
      defineEmitRules<FailForm>({
        items: {
          x: () => {
            throw new Error('boom');
          },
        },
      }),
    );
    await expect(
      engine.propagate({
        form: { items: [{ id: 1, x: 0 }] },
        rowIds: { items: ['r1'] },
        manual: { has: () => false },
        all: true,
      }),
    ).rejects.toThrow(/items\[r1\]\.x/);
  });
});
