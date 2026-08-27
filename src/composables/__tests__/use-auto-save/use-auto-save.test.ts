import { createApp, effectScope, ref, watch, type EffectScope, type Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useAutoSave,
  type AutoSaveHandler,
  type UseAutoSaveOptions,
  type UseAutoSaveReturn,
} from '../../use-auto-save/use-auto-save';
import type { MaybeRefOrGetter } from 'vue';

interface FormState {
  name: string;
}

/** Mirrors the positional signature while keeping the tests declarative. */
type AutoSaveSetup = UseAutoSaveOptions<FormState> & {
  source: MaybeRefOrGetter<FormState>;
  save: AutoSaveHandler<FormState>;
};

function deferred() {
  let resolve!: () => void;
  let reject!: (failure: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useAutoSave', () => {
  let scope: EffectScope;

  const createAutoSave = ({ source, save, ...options }: AutoSaveSetup) => {
    const autoSave = scope.run(() => useAutoSave(source, save, options));
    if (!autoSave) throw new Error('effect scope did not return auto-save');
    return autoSave;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('debounces changes and saves the latest value', async () => {
    const source = ref<FormState>({ name: '' });
    const values: string[] = [];
    const save = vi.fn((value: FormState) => {
      values.push(value.name);
    });
    const autoSave = createAutoSave({
      source,
      save,
      debounceMs: 100,
    });

    source.value.name = 'first';
    source.value.name = 'latest';

    expect(autoSave.status.value).toBe('pending');
    await vi.advanceTimersByTimeAsync(99);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(values).toEqual(['latest']);
    expect(autoSave.status.value).toBe('saved');
    expect(autoSave.lastSavedAt.value).not.toBeNull();
  });

  it('serializes a later revision behind an in-flight save', async () => {
    const source = ref<FormState>({ name: '' });
    const operations: Array<ReturnType<typeof deferred>> = [];
    const started: string[] = [];
    const save = vi.fn((value: FormState) => {
      started.push(value.name);
      const operation = deferred();
      operations.push(operation);
      return operation.promise;
    });
    createAutoSave({ source, save, debounceMs: 100 });

    source.value.name = 'first';
    await vi.advanceTimersByTimeAsync(100);
    expect(started).toEqual(['first']);

    source.value.name = 'second';
    await vi.advanceTimersByTimeAsync(100);
    expect(started).toEqual(['first']);

    operations[0]?.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toEqual(['first', 'second']);

    operations[1]?.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('flushes the current revision immediately', async () => {
    const source = ref<FormState>({ name: '' });
    const values: string[] = [];
    const save = vi.fn((value: FormState) => {
      values.push(value.name);
    });
    const autoSave = createAutoSave({
      source,
      save,
      debounceMs: 100,
    });

    source.value.name = 'flush';
    await autoSave.flush();

    expect(values).toEqual(['flush']);
    expect(autoSave.status.value).toBe('saved');

    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledOnce();
  });

  it('allows flush to persist a change made while auto-save is disabled', async () => {
    const enabled = ref(false);
    const source = ref<FormState>({ name: '' });
    const save = vi.fn();
    const autoSave = createAutoSave({
      source,
      save,
      enabled,
      debounceMs: 100,
    });

    source.value.name = 'manual';
    await vi.runAllTimersAsync();

    expect(save).not.toHaveBeenCalled();
    expect(autoSave.status.value).toBe('idle');

    await autoSave.flush();
    expect(save).toHaveBeenCalledOnce();
  });

  it('discards nested paused changes and resumes on the next change', async () => {
    const source = ref<FormState>({ name: '' });
    const values: string[] = [];
    const autoSave = createAutoSave({
      source,
      save: (value) => {
        values.push(value.name);
      },
      debounceMs: 100,
    });

    await autoSave.withPaused(async () => {
      source.value.name = 'outer';
      await autoSave.withPaused(() => {
        source.value.name = 'inner';
      });
    });
    await vi.runAllTimersAsync();
    expect(values).toEqual([]);

    source.value.name = 'resumed';
    await vi.runAllTimersAsync();
    expect(values).toEqual(['resumed']);
  });

  it('restarts a pending timer when debounceMs changes', async () => {
    const debounceMs = ref(100);
    const source = ref<FormState>({ name: '' });
    const save = vi.fn();
    createAutoSave({ source, save, debounceMs });

    source.value.name = 'delayed';
    await vi.advanceTimersByTimeAsync(50);
    debounceMs.value = 200;
    await vi.advanceTimersByTimeAsync(199);

    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledOnce();
  });

  it('reports automatic save failures and retries a later revision', async () => {
    const failure = new Error('save failed');
    const source = ref<FormState>({ name: '' });
    const onError = vi.fn();
    const save = vi
      .fn<(value: FormState) => void | Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce();
    const autoSave = createAutoSave({
      source,
      save,
      onError,
      debounceMs: 100,
    });

    source.value.name = 'fails';
    await vi.runAllTimersAsync();

    expect(autoSave.status.value).toBe('error');
    expect(autoSave.error.value).toBe(failure);
    expect(onError).toHaveBeenCalledWith(failure);

    source.value.name = 'recovers';
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenCalledTimes(2);
    expect(autoSave.status.value).toBe('saved');
    expect(autoSave.error.value).toBeNull();
  });

  it('continues with a newer debounced revision after an in-flight failure', async () => {
    const failure = new Error('first save failed');
    const firstSave = deferred();
    const source = ref<FormState>({ name: '' });
    const started: string[] = [];
    const save = vi.fn((value: FormState) => {
      started.push(value.name);
      return started.length === 1 ? firstSave.promise : undefined;
    });
    createAutoSave({ source, save, debounceMs: 100 });

    source.value.name = 'first';
    await vi.advanceTimersByTimeAsync(100);
    source.value.name = 'second';
    await vi.advanceTimersByTimeAsync(100);

    firstSave.reject(failure);
    await vi.advanceTimersByTimeAsync(0);

    expect(started).toEqual(['first', 'second']);
  });

  it('aborts an in-flight save when its scope is disposed', async () => {
    const source = ref<FormState>({ name: '' });
    let receivedSignal: AbortSignal | undefined;
    const autoSave = createAutoSave({
      source,
      save: (_value, signal) => {
        receivedSignal = signal;
        return new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      },
      debounceMs: 100,
    });

    source.value.name = 'saving';
    const flushing = autoSave.flush();
    await vi.advanceTimersByTimeAsync(0);
    scope.stop();

    await expect(flushing).rejects.toMatchObject({ name: 'AbortError' });
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('stops source and option watchers after scope disposal', () => {
    const sourceState = ref<FormState>({ name: '' });
    const enabledState = ref(true);
    let sourceReads = 0;
    let enabledReads = 0;
    createAutoSave({
      source: () => {
        sourceReads += 1;
        return sourceState.value;
      },
      enabled: () => {
        enabledReads += 1;
        return enabledState.value;
      },
      save: vi.fn(),
      debounceMs: 100,
    });

    scope.stop();
    const readsAtDisposal = { sourceReads, enabledReads };
    sourceState.value = { name: 'after' };
    enabledState.value = false;

    expect({ sourceReads, enabledReads }).toEqual(readsAtDisposal);
  });

  it('does not invoke save after a status observer disposes the scope', async () => {
    const source = ref<FormState>({ name: '' });
    const save = vi.fn();
    let autoSave!: UseAutoSaveReturn;
    scope.run(() => {
      autoSave = useAutoSave(source, save, { debounceMs: 100 });
      watch(
        autoSave.status,
        (status) => {
          if (status === 'saving') scope.stop();
        },
        { flush: 'sync' },
      );
    });

    source.value.name = 'dispose';

    await expect(autoSave.flush()).rejects.toThrow('disposed');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not invoke onError after an error observer disposes the scope', async () => {
    const failure = new Error('save failed');
    const source = ref<FormState>({ name: '' });
    const onError = vi.fn();
    let autoSave!: UseAutoSaveReturn;
    scope.run(() => {
      autoSave = useAutoSave(
        source,
        () => {
          throw failure;
        },
        { onError, debounceMs: 100 },
      );
      watch(
        autoSave.error,
        (error) => {
          if (error) scope.stop();
        },
        { flush: 'sync' },
      );
    });

    source.value.name = 'dispose';
    await vi.runAllTimersAsync();

    expect(onError).not.toHaveBeenCalled();
  });

  it('rejects withPaused after disposal without invoking its task', async () => {
    const source = ref<FormState>({ name: '' });
    const autoSave = createAutoSave({
      source,
      save: vi.fn(),
      debounceMs: 100,
    });
    const task = vi.fn();

    scope.stop();

    await expect(autoSave.withPaused(task)).rejects.toThrow('disposed');
    expect(task).not.toHaveBeenCalled();
  });

  it('returns a paused task result when the task disposes its own scope', async () => {
    const source = ref<FormState>({ name: '' });
    const autoSave = createAutoSave({
      source,
      save: vi.fn(),
      debounceMs: 100,
    });

    const result = await autoSave.withPaused(() => {
      scope.stop();
      return 'navigated';
    });

    expect(result).toBe('navigated');
  });

  it('preserves source getter errors handled by a component', () => {
    const failure = new Error('source getter failed');
    let source!: Ref<FormState>;
    let shouldFail!: Ref<boolean>;
    let autoSave!: UseAutoSaveReturn;
    const host = document.createElement('div');
    const app = createApp({
      setup() {
        source = ref<FormState>({ name: '' });
        shouldFail = ref(false);
        autoSave = useAutoSave(
          () => {
            if (shouldFail.value) throw failure;
            return source.value;
          },
          vi.fn(),
          { debounceMs: 100 },
        );
        return () => null;
      },
    });
    app.config.errorHandler = () => undefined;
    app.mount(host);

    try {
      source.value.name = 'pending';

      expect(() => {
        shouldFail.value = true;
      }).not.toThrow();
      expect(autoSave.status.value).toBe('error');
      expect(autoSave.error.value).toBe(failure);
    } finally {
      app.unmount();
    }
  });
});
