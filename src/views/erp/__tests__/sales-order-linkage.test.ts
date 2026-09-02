import { effectScope, ref, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useEmitEffect,
  type EmitEffectConfirmation,
  type UseEmitEffectReturn,
} from '@/composables';
import {
  createSalesLine,
  createSalesOrderSeed,
  defaultSalesOrderForm,
  salesOrderRules,
  type SalesOrderForm,
} from '../sales-order-linkage';

async function settle(api: UseEmitEffectReturn<SalesOrderForm>): Promise<void> {
  for (let i = 0; i < 400 && api.pending.value; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(api.pending.value).toBe(false);
}

describe('sales order linkage', () => {
  let scope: EffectScope;

  beforeEach(() => {
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  it('seed is already normalized: loading then normalizing changes nothing', async () => {
    const form = ref<SalesOrderForm>(createSalesOrderSeed());
    const before = JSON.stringify(form.value);
    const api = scope.run(() => useEmitEffect(form, salesOrderRules))!;
    await settle(api);
    await api.normalize();
    expect(JSON.stringify(form.value)).toBe(before);
  });

  it('new document gets rates, totals and line defaults filled', async () => {
    const form = ref<SalesOrderForm>({ ...defaultSalesOrderForm, lines: [] });
    const api = scope.run(() => useEmitEffect(form, salesOrderRules, { immediate: true }))!;
    await settle(api);
    expect(form.value.exchangeRate).toBe(1);
    expect(form.value.totalAmount).toBe(0);

    form.value.customerId = 'customer-channel';
    await settle(api);
    expect(form.value.warehouseId).toBe('WH-BJ');

    form.value.lines.push(createSalesLine(-1));
    await settle(api);
    const line = form.value.lines[0]!;
    expect(line.currency).toBe('CNY');
    expect(line.warehouseId).toBe('WH-BJ');
    expect(line.taxRate).toBe(0.13);
    expect(line.unitPrice).toBeNull();

    line.productId = 'notebook';
    await settle(api);
    expect(line.unitPrice).toBe(6460);
    expect(line.amount).toBe(7299.8);
    expect(form.value.totalAmount).toBe(7299.8);
  });

  it('changing the customer reprices only lines without a manual price and asks first', async () => {
    const confirm = vi.fn<(c: EmitEffectConfirmation) => Promise<boolean>>(async () => true);
    const form = ref<SalesOrderForm>(createSalesOrderSeed());
    const api = scope.run(() => useEmitEffect(form, salesOrderRules, { confirm }))!;
    await settle(api);

    form.value.lines[1]!.unitPrice = 1500;
    await settle(api);
    expect(api.isManual([form.value.lines[1]!, 'unitPrice'])).toBe(true);
    expect(form.value.lines[1]!.amount).toBe(6780);

    form.value.customerId = 'customer-channel';
    await settle(api);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]![0]).toMatchObject({
      field: 'customerId',
      preservedCount: 1,
    });
    expect(form.value.lines[0]!.unitPrice).toBe(6460);
    expect(form.value.lines[1]!.unitPrice).toBe(1500);
    expect(form.value.warehouseId).toBe('WH-BJ');
    expect(form.value.lines[0]!.warehouseId).toBe('WH-BJ');
    expect(form.value.lines[0]!.amount).toBe(14599.6);
    expect(form.value.totalAmount).toBe(21379.6);
  });

  it('rejecting the confirmation rolls the customer back and leaves the lines untouched', async () => {
    const form = ref<SalesOrderForm>(createSalesOrderSeed());
    const api = scope.run(() =>
      useEmitEffect(form, salesOrderRules, { confirm: async () => false }),
    )!;
    await settle(api);
    const before = JSON.stringify(form.value);

    form.value.customerId = 'customer-channel';
    await settle(api);
    expect(JSON.stringify(form.value)).toBe(before);
  });

  it('currency change refreshes the rate and syncs every line; a manual rate is refreshed too', async () => {
    const form = ref<SalesOrderForm>(createSalesOrderSeed());
    const api = scope.run(() => useEmitEffect(form, salesOrderRules))!;
    await settle(api);

    form.value.exchangeRate = 1.5;
    await settle(api);
    expect(api.isManual('exchangeRate')).toBe(true);
    expect(form.value.lines[0]!.localAmount).toBe(23052);

    form.value.currency = 'USD';
    await settle(api);
    expect(form.value.exchangeRate).toBe(7.2);
    expect(api.isManual('exchangeRate')).toBe(false);
    expect(form.value.lines.every((line) => line.currency === 'USD')).toBe(true);
    expect(form.value.totalLocalAmount).toBe(169228.8);
  });

  it('header warehouse follows to lines except where a line was set by hand', async () => {
    const form = ref<SalesOrderForm>(createSalesOrderSeed());
    const api = scope.run(() => useEmitEffect(form, salesOrderRules))!;
    await settle(api);

    form.value.lines[1]!.warehouseId = 'WH-SZ';
    await settle(api);
    form.value.warehouseId = 'WH-BJ';
    await settle(api);
    expect(form.value.lines.map((line) => line.warehouseId)).toEqual(['WH-BJ', 'WH-SZ']);

    await api.restore([form.value.lines[1]!, 'warehouseId']);
    expect(form.value.lines[1]!.warehouseId).toBe('WH-BJ');
  });
});
