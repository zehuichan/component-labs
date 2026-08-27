import {
  createApp,
  effectScope,
  ref,
  watch,
  type EffectScope,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useFormDraft,
  type UseFormDraftOptions,
  type UseFormDraftReturn,
} from '../../use-form-draft/use-form-draft';

interface FormState {
  name: string;
  note?: string;
}

/** Mirrors the positional signature while keeping the tests declarative. */
type DraftSetup = UseFormDraftOptions<FormState> & { key?: MaybeRefOrGetter<string> };

describe('useFormDraft', () => {
  let scope: EffectScope;

  const createDraft = (form: Ref<FormState>, { key = 'draft', ...options }: DraftSetup = {}) => {
    const draft = scope.run(() => useFormDraft(form, key, { debounceMs: 100, ...options }));

    if (!draft) throw new Error('effect scope did not return a draft');
    return draft;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('persists the latest form after the debounce window', () => {
    const form = ref<FormState>({ name: '' });
    const draft = createDraft(form);

    form.value.name = 'Ada';

    expect(draft.isPending.value).toBe(true);
    expect(localStorage.getItem('draft')).toBeNull();

    vi.advanceTimersByTime(99);
    expect(localStorage.getItem('draft')).toBeNull();

    vi.advanceTimersByTime(1);
    expect(localStorage.getItem('draft')).toBe('{"name":"Ada"}');
    expect(draft.isPending.value).toBe(false);
  });

  it('flushes immediately and cancels the pending timer', () => {
    const form = ref<FormState>({ name: '' });
    const draft = createDraft(form);

    form.value.name = 'Grace';

    expect(draft.flush()).toBe(true);
    expect(localStorage.getItem('draft')).toBe('{"name":"Grace"}');
    expect(draft.isPending.value).toBe(false);

    localStorage.removeItem('draft');
    vi.runAllTimers();
    expect(localStorage.getItem('draft')).toBeNull();
  });

  it('restores a draft over defaults without scheduling another write', () => {
    localStorage.setItem('draft', '{"name":"Lin"}');
    const form = ref<FormState>({ name: 'current' });
    const draft = createDraft(form, {
      defaults: { name: 'default', note: 'fallback' },
    });

    expect(draft.restore()).toBe(true);
    expect(form.value).toEqual({ name: 'Lin', note: 'fallback' });
    expect(draft.isPending.value).toBe(false);
  });

  it('clears storage and cancels a pending write', () => {
    localStorage.setItem('draft', '{"name":"old"}');
    const form = ref<FormState>({ name: '' });
    const draft = createDraft(form);

    form.value.name = 'new';

    expect(draft.clear()).toBe(true);
    expect(localStorage.getItem('draft')).toBeNull();
    expect(draft.isPending.value).toBe(false);

    vi.runAllTimers();
    expect(localStorage.getItem('draft')).toBeNull();
  });

  it('cancels pending work when disabled and waits for a later change', () => {
    const enabled = ref(true);
    const form = ref<FormState>({ name: '' });
    const draft = createDraft(form, { enabled });

    form.value.name = 'ignored';
    enabled.value = false;
    vi.runAllTimers();

    expect(draft.isPending.value).toBe(false);
    expect(localStorage.getItem('draft')).toBeNull();

    enabled.value = true;
    form.value.name = 'saved';
    vi.runAllTimers();

    expect(localStorage.getItem('draft')).toBe('{"name":"saved"}');
  });

  it('cancels the old pending write when the key changes', () => {
    localStorage.setItem('old-draft', '{"name":"stored-old"}');
    localStorage.setItem('new-draft', '{"name":"stored-new"}');
    const key = ref('old-draft');
    const form = ref<FormState>({ name: '' });
    const draft = createDraft(form, { key });

    form.value.name = 'old';
    key.value = 'new-draft';
    vi.runAllTimers();

    expect(draft.isPending.value).toBe(false);
    expect(form.value.name).toBe('old');
    expect(localStorage.getItem('old-draft')).toBe('{"name":"stored-old"}');
    expect(localStorage.getItem('new-draft')).toBe('{"name":"stored-new"}');

    form.value.name = 'new';
    vi.runAllTimers();
    expect(localStorage.getItem('new-draft')).toBe('{"name":"new"}');
  });

  it('restarts a pending timer when debounceMs changes', () => {
    const debounceMs = ref(100);
    const form = ref<FormState>({ name: '' });
    createDraft(form, { debounceMs });

    form.value.name = 'Ada';
    vi.advanceTimersByTime(50);
    debounceMs.value = 200;
    vi.advanceTimersByTime(199);

    expect(localStorage.getItem('draft')).toBeNull();

    vi.advanceTimersByTime(1);
    expect(localStorage.getItem('draft')).toBe('{"name":"Ada"}');
  });

  it('ignores nested paused changes and resumes on the next change', async () => {
    const form = ref<FormState>({ name: '' });
    const draft = createDraft(form);

    await draft.withPaused(async () => {
      form.value.name = 'outer';
      await draft.withPaused(() => {
        form.value.name = 'inner';
      });
    });
    vi.runAllTimers();

    expect(draft.isPending.value).toBe(false);
    expect(localStorage.getItem('draft')).toBeNull();

    form.value.name = 'resumed';
    vi.runAllTimers();
    expect(localStorage.getItem('draft')).toBe('{"name":"resumed"}');
  });

  it('cancels pending work and disables controls after scope disposal', () => {
    const key = ref('draft');
    let keyReads = 0;
    const form = ref<FormState>({ name: '' });
    const draft = createDraft(form, {
      key: () => {
        keyReads += 1;
        return key.value;
      },
    });

    form.value.name = 'discarded';
    scope.stop();
    const readsAtDisposal = keyReads;
    key.value = 'after-disposal';
    form.value.name = 'also-discarded';
    vi.runAllTimers();

    expect(keyReads).toBe(readsAtDisposal);
    expect(localStorage.getItem('draft')).toBeNull();
    expect(draft.flush()).toBe(false);
    expect(draft.restore()).toBe(false);
    expect(draft.clear()).toBe(false);
  });

  it('rejects paused operations entered after scope disposal', async () => {
    const form = ref<FormState>({ name: '' });
    const draft = createDraft(form);
    const task = vi.fn();
    scope.stop();

    await expect(draft.withPaused(task)).rejects.toThrow(/disposed/i);
    expect(task).not.toHaveBeenCalled();
  });

  it('does not call onError after an error-state watcher disposes the scope', () => {
    const onError = vi.fn();
    const form = ref<FormState>({ name: '' });
    const draft = scope.run(() => {
      const value = useFormDraft(form, 'draft', { onError });
      watch(
        value.error,
        (failure) => {
          if (failure) scope.stop();
        },
        { flush: 'sync' },
      );
      return value;
    });
    if (!draft) throw new Error('effect scope did not return a draft');
    const circular = { name: 'broken' } as FormState & { self?: FormState };
    circular.self = circular;
    form.value = circular;

    expect(() => draft.flush()).toThrow();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports serialization errors and clears the error after recovery', () => {
    const onError = vi.fn();
    const form = ref<FormState>({ name: '' });
    const draft = createDraft(form, { onError });
    const circular = { name: 'broken' } as FormState & {
      self?: FormState;
    };
    circular.self = circular;
    form.value = circular;

    expect(() => draft.flush()).toThrow();
    expect(draft.error.value).toBeInstanceOf(TypeError);
    expect(onError).toHaveBeenCalledOnce();

    form.value = { name: 'recovered' };
    expect(draft.flush()).toBe(true);
    expect(draft.error.value).toBeNull();
  });

  it.each([
    ['key', 'draft'],
    ['enabled', true],
    ['debounceMs', 100],
  ] as const)(
    'reports a reactive %s getter failure and cancels pending work',
    (name, initialValue) => {
      const failure = new Error('getter failed');
      const shouldFail = ref(false);
      const onError = vi.fn();
      const form = ref<FormState>({ name: '' });
      const option = {
        [name]: () => {
          if (shouldFail.value) throw failure;
          return initialValue;
        },
      } as Partial<UseFormDraftOptions<FormState>>;
      const draft = createDraft(form, { ...option, onError });

      form.value.name = 'pending';

      expect(() => {
        shouldFail.value = true;
      }).toThrow(failure);
      expect(draft.isPending.value).toBe(false);
      expect(draft.error.value).toBe(failure);
      expect(onError).toHaveBeenCalledOnce();
    },
  );

  it('keeps a key getter error when a component error handler absorbs it', () => {
    const failure = new Error('key getter failed');
    let form!: Ref<FormState>;
    let shouldFail!: Ref<boolean>;
    let draft!: UseFormDraftReturn;
    const host = document.createElement('div');
    const app = createApp({
      setup() {
        form = ref<FormState>({ name: '' });
        shouldFail = ref(false);
        draft = useFormDraft(
          form,
          () => {
            if (shouldFail.value) throw failure;
            return 'draft';
          },
          { debounceMs: 100 },
        );
        return () => null;
      },
    });
    app.config.errorHandler = () => undefined;
    app.mount(host);

    try {
      form.value.name = 'pending';

      expect(() => {
        shouldFail.value = true;
      }).not.toThrow();
      expect(draft.isPending.value).toBe(false);
      expect(draft.error.value).toBe(failure);
    } finally {
      app.unmount();
    }
  });
});
