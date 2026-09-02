import { effectScope, ref, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useEmitEffect,
  type EmitEffectConfirmation,
  type UseEmitEffectReturn,
} from '@/composables';
import {
  createFclQuotationSeed,
  createFeeRow,
  createLclQuotationSeed,
  createQuotationItem,
  quotationRules,
  type QuotationForm,
} from '../supplier-quotation-linkage';

async function settle(api: UseEmitEffectReturn<QuotationForm>): Promise<void> {
  for (let i = 0; i < 400 && api.pending.value; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(api.pending.value).toBe(false);
}

describe('supplier quotation linkage (gysbjtb DTO)', () => {
  let scope: EffectScope;

  beforeEach(() => {
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  it('both stored seeds are fixpoints of the rules', async () => {
    for (const seed of [createLclQuotationSeed, createFclQuotationSeed]) {
      const form = ref<QuotationForm>(seed());
      const before = JSON.stringify(form.value);
      const api = scope.run(() => useEmitEffect(form, quotationRules))!;
      await settle(api);
      await api.normalize();
      expect(JSON.stringify(form.value)).toBe(before);
    }
  });

  it('foreign and RMB unit prices convert both ways; the edited side is the anchor', async () => {
    const form = ref<QuotationForm>(createLclQuotationSeed());
    const api = scope.run(() => useEmitEffect(form, quotationRules))!;
    await settle(api);
    const item = form.value.quotation_items[0]!;

    item.fx_unit_price = 100;
    await settle(api);
    expect(item.rmb_unit_price).toBe(718);
    expect(item.fx_amount).toBe(1250);
    expect(item.rmb_amount).toBe(8975);
    expect(form.value.ocean_total).toBe(8975);
    expect(form.value.quote_amount).toBe(10975);
    expect(api.isManual([item, 'fx_unit_price'])).toBe(true);
    expect(api.isManual([item, 'rmb_unit_price'])).toBe(false);

    item.rmb_unit_price = 700;
    await settle(api);
    expect(item.fx_unit_price).toBe(97.49);
    expect(item.rmb_amount).toBe(8750);
    expect(form.value.quote_amount).toBe(10750);
    expect(api.isManual([item, 'rmb_unit_price'])).toBe(true);
    expect(api.isManual([item, 'fx_unit_price'])).toBe(false);
  });

  it('trade term only changes the total; currency change asks before repricing RMB', async () => {
    const confirm = vi.fn<(c: EmitEffectConfirmation) => Promise<boolean>>(async () => true);
    const form = ref<QuotationForm>(createFclQuotationSeed());
    const api = scope.run(() => useEmitEffect(form, quotationRules, { confirm }))!;
    await settle(api);

    form.value.trade_term = 'CIF';
    await settle(api);
    expect(form.value.quote_amount).toBe(52630);
    expect(confirm).not.toHaveBeenCalled();

    form.value.currency_type = 1;
    await settle(api);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]![0]).toMatchObject({
      field: 'currency_type',
      oldValue: 2,
      newValue: 1,
      preservedCount: 0,
    });
    expect(confirm.mock.calls[0]![0].affected).toHaveLength(2);
    expect(form.value.exchange_rate).toBe(7.18);
    expect(form.value.quotation_items.map((item) => item.rmb_unit_price)).toEqual([13283, 7898]);
    expect(form.value.ocean_total).toBe(34464);
    expect(form.value.quote_amount).toBe(49654);
  });

  it('rejecting the reprice restores the currency and keeps every price', async () => {
    const form = ref<QuotationForm>(createFclQuotationSeed());
    const api = scope.run(() =>
      useEmitEffect(form, quotationRules, { confirm: async () => false }),
    )!;
    await settle(api);
    const before = JSON.stringify(form.value);

    form.value.currency_type = 1;
    await settle(api);
    expect(form.value.currency_type).toBe(2);
    expect(JSON.stringify(form.value)).toBe(before);
  });

  it('fee rows follow the catalogue; a manual price is dropped when the fee item changes', async () => {
    const form = ref<QuotationForm>(createLclQuotationSeed());
    const api = scope.run(() => useEmitEffect(form, quotationRules))!;
    await settle(api);
    const fee = form.value.quote_pol_fee_rows[0]!;

    fee.unit_price = 400;
    await settle(api);
    expect(fee.amount).toBe(400);
    expect(form.value.pol_total).toBe(850);
    expect(form.value.quote_amount).toBe(9678.75);

    fee.field = 'pol_trucking_fee';
    await settle(api);
    expect(fee).toMatchObject({ fee_name: '拖车费', unit: '/柜', unit_price: 1200, amount: 1200 });
    expect(api.isManual([fee, 'unit_price'])).toBe(false);
    expect(form.value.pol_total).toBe(1650);
    expect(form.value.quote_amount).toBe(10478.75);

    form.value.quote_pol_fee_rows.splice(1, 1);
    await settle(api);
    expect(form.value.pol_total).toBe(1200);
    expect(form.value.quote_amount).toBe(10028.75);
  });

  it('new rows in any sub-table are filled and rolled into the totals', async () => {
    const form = ref<QuotationForm>(createLclQuotationSeed());
    const api = scope.run(() => useEmitEffect(form, quotationRules))!;
    await settle(api);

    form.value.quote_pod_fee_rows.push(createFeeRow(-1, 'pod_delivery_fee'));
    await settle(api);
    expect(form.value.quote_pod_fee_rows[1]).toMatchObject({
      fee_name: '目的港派送费',
      unit: '/柜',
      unit_price: 1500,
      amount: 1500,
    });
    expect(form.value.pod_total).toBe(2400);
    expect(form.value.quote_amount).toBe(11128.75);

    form.value.quotation_items.push(createQuotationItem(-2));
    await settle(api);
    const item = form.value.quotation_items[1]!;
    expect(item.rmb_unit_price).toBeNull();
    expect(item.rmb_amount).toBe(0);

    item.fx_unit_price = 50;
    await settle(api);
    expect(item.rmb_unit_price).toBe(359);
    expect(form.value.ocean_total).toBe(7987.75);
    expect(form.value.quote_amount).toBe(11487.75);

    // Files carry no rules; they ride along in the same DTO untouched.
    form.value.quote_pod_files.push({ id: -3, name: 'a.pdf', size: 10 });
    await settle(api);
    expect(form.value.quote_pod_files).toHaveLength(1);
  });
});
