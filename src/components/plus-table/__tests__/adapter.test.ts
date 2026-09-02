import { beforeAll, describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import { initComponentAdapter, useGlobalShareState } from '@/adapter';

import { resolveEditor, typedCharToDraft } from '../adapter';

const ctx = { row: { id: 1 }, rowIndex: 0 };

beforeAll(() => {
  initComponentAdapter();
});

describe('resolveEditor', () => {
  it('defaults to input when component is omitted', () => {
    const resolved = resolveEditor({}, ctx);
    expect(resolved.component).toBe(useGlobalShareState().getComponents().input);
    expect(resolved.trigger).toBe('blur');
    expect(resolved.modelProp).toBe('modelValue');
  });

  it('resolves builtin string component and merges column componentProps', () => {
    const resolved = resolveEditor(
      {
        component: 'textarea',
        componentProps: { placeholder: '备注' },
      },
      ctx,
    );
    expect(resolved.component).toBe(useGlobalShareState().getComponents().textarea);
    expect(resolved.componentProps).toEqual({ placeholder: '备注' });
    expect(resolved.trigger).toBe('blur');
  });

  it('resolves input-number with blur trigger (defaults live in wrapper)', () => {
    const resolved = resolveEditor({ component: 'input-number' }, ctx);
    expect(resolved.component).toBe(useGlobalShareState().getComponents()['input-number']);
    expect(resolved.componentProps).toEqual({});
    expect(resolved.trigger).toBe('blur');
  });

  it('resolves select with change trigger', () => {
    const resolved = resolveEditor(
      {
        component: 'select',
        componentProps: { options: [{ label: 'A', value: 'a' }] },
      },
      ctx,
    );
    expect(resolved.component).toBe(useGlobalShareState().getComponents().select);
    expect(resolved.trigger).toBe('change');
    expect(resolved.componentProps.options).toEqual([{ label: 'A', value: 'a' }]);
  });

  it('accepts a Vue component and custom modelProp', () => {
    const Comp = defineComponent({ name: 'CustomEditor', setup: () => () => null });
    const resolved = resolveEditor(
      { component: Comp, modelProp: 'value', componentProps: { size: 'small' } },
      ctx,
    );
    expect(resolved.component).toBe(Comp);
    expect(resolved.modelProp).toBe('value');
    expect(resolved.componentProps).toEqual({ size: 'small' });
    expect(resolved.trigger).toBe('blur');
  });

  it('evaluates function componentProps with row context', () => {
    const resolved = resolveEditor(
      {
        component: 'input',
        componentProps: ({ row }) => ({ placeholder: String(row.id) }),
      },
      ctx,
    );
    expect(resolved.componentProps).toEqual({ placeholder: '1' });
  });

  it('rejects unknown builtin component name', () => {
    expect(() => resolveEditor({ component: 'not-a-editor' as 'input' }, ctx)).toThrow(
      /未知的 component/,
    );
  });
});

describe('typedCharToDraft', () => {
  it('seeds input with the typed char', () => {
    expect(typedCharToDraft({ component: 'input' }, 'a')).toBe('a');
  });

  it('seeds input-number only for digits', () => {
    expect(typedCharToDraft({ component: 'input-number' }, '3')).toBe(3);
    expect(typedCharToDraft({ component: 'input-number' }, 'x')).toBeUndefined();
  });

  it('does not seed select', () => {
    expect(typedCharToDraft({ component: 'select' }, 'a')).toBeUndefined();
  });
});
