import { effectScope, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDraft, EmitEffectRules } from '../../use-emit-effect/emit-effect';
import { useEmitEffect } from '../../use-emit-effect/use-emit-effect';

const rules: EmitEffectRules = {
  sourceFields: ['warehouseId'],
  headerRules: {
    currency: {
      policy: 'force',
      requiresConfirmation: true,
      apply: (_line, nextHeader) => ({
        patch: { currency: nextHeader.currency },
      }),
    },
    warehouseId: {
      policy: 'inherit',
      apply: (line, nextHeader) =>
        line.fieldSources.warehouseId === 'manual'
          ? { preservedFields: ['warehouseId'] }
          : { patch: { warehouseId: nextHeader.warehouseId } },
    },
    multiplier: {
      policy: 'recalculate',
      apply: () => ({}),
    },
  },
  createLine: (_draft, id) => ({
    id,
    fieldSources: { warehouseId: 'inherited' },
    quantity: 1,
    currency: 'CNY',
    warehouseId: 'WH-A',
    amount: 2,
  }),
  recalculateLine: (line, header) => ({
    ...line,
    amount: Number(line.quantity) * Number(header.multiplier),
  }),
  summarize: (lines) => ({
    total: lines.reduce((sum, line) => sum + Number(line.amount), 0),
  }),
};

function initialDraft(): DocumentDraft {
  return {
    dirty: false,
    header: { currency: 'CNY', warehouseId: 'WH-A', multiplier: 2 },
    lines: [
      {
        id: '1',
        fieldSources: { warehouseId: 'inherited' },
        quantity: 2,
        currency: 'CNY',
        warehouseId: 'WH-A',
        amount: 4,
      },
      {
        id: '2',
        fieldSources: { warehouseId: 'manual' },
        quantity: 3,
        currency: 'CNY',
        warehouseId: 'WH-B',
        amount: 6,
      },
    ],
    summary: { total: 10 },
  };
}

describe('useEmitEffect', () => {
  let scope: EffectScope;

  beforeEach(() => {
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  it('applies header mutations that need no confirmation', async () => {
    const api = scope.run(() => useEmitEffect(rules, initialDraft()))!;

    const ok = await api.changeHeader('multiplier', 3);
    expect(ok).toBe(true);
    expect(api.draft.value.summary.total).toBe(15);
    expect(api.draft.value.dirty).toBe(true);
  });

  it('skips commit when confirm returns false', async () => {
    const confirm = vi.fn(async () => false);
    const api = scope.run(() => useEmitEffect(rules, initialDraft(), { confirm }))!;

    const ok = await api.changeHeader('currency', 'USD');
    expect(ok).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(api.draft.value.header.currency).toBe('CNY');
    expect(api.draft.value.dirty).toBe(false);
  });

  it('commits after confirm returns true', async () => {
    const api = scope.run(() =>
      useEmitEffect(rules, initialDraft(), { confirm: async () => true }),
    )!;

    const ok = await api.changeHeader('currency', 'USD');
    expect(ok).toBe(true);
    expect(api.draft.value.lines.every((line) => line.currency === 'USD')).toBe(true);
  });

  it('resets to the initial snapshot', async () => {
    const api = scope.run(() => useEmitEffect(rules, initialDraft()))!;
    await api.changeHeader('multiplier', 3);
    api.reset();
    expect(api.draft.value.summary.total).toBe(10);
    expect(api.draft.value.dirty).toBe(false);
  });
});
