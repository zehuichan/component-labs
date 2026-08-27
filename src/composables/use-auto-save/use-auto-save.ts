import { readonly, shallowRef, toValue, type MaybeRefOrGetter, type Ref } from 'vue';
import { tryOnScopeDispose, useTimeoutFn } from '@vueuse/core';
import { watchReadable } from '../shared/watch-readable';

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Persists the latest value evaluated when a save starts.
 * Must not call this instance's flush or withPaused controls.
 */
export type AutoSaveHandler<T> = (value: T, signal: AbortSignal) => void | Promise<void>;

export interface UseAutoSaveOptions<T> {
  /** Whether source changes may schedule automatic saves. */
  enabled?: MaybeRefOrGetter<boolean>;
  /** Delay before an automatic save starts. */
  debounceMs?: MaybeRefOrGetter<number>;
  /** Called after a value is persisted successfully. */
  onSuccess?: (value: T) => void;
  /** Receives source evaluation, persistence, and control failures. */
  onError?: (error: unknown) => void;
}

export interface UseAutoSaveReturn {
  /** Current state of the automatic save pipeline. */
  status: Readonly<Ref<AutoSaveStatus>>;
  /** Epoch timestamp of the latest successful save. */
  lastSavedAt: Readonly<Ref<number | null>>;
  /** Last source evaluation, persistence, or control failure. */
  error: Readonly<Ref<unknown | null>>;
  /**
   * Cancels the debounce and persists every revision known when called.
   * Rejects when paused, disposed before completion, or persistence fails.
   */
  flush: () => Promise<void>;
  /**
   * Discards pending and nested changes while the operation runs.
   * The existing save pipeline settles before the operation starts.
   */
  withPaused: <R>(task: () => R | Promise<R>) => Promise<R>;
}

const onSettled = (task: Promise<unknown>, cleanup: () => void): void => {
  void task.then(cleanup, cleanup);
};

/**
 * Serializes debounced server-side draft saves without overlapping requests.
 *
 * Local drafts and save hotkeys remain separate concerns. A save callback that
 * requires an immutable payload should provide a getter that creates one.
 *
 * @param source Reactive value observed with deep semantics.
 * @param save Persists the value captured when a save starts.
 *
 * @example
 * const { status, flush } = useAutoSave(form, (value) => api.save(value), {
 *   debounceMs: 1000,
 * })
 */
export function useAutoSave<T>(
  source: MaybeRefOrGetter<T>,
  save: AutoSaveHandler<T>,
  options: UseAutoSaveOptions<T> = {},
): UseAutoSaveReturn {
  const { enabled = true, debounceMs = 2000, onSuccess, onError } = options;

  const status = shallowRef<AutoSaveStatus>('idle');
  const lastSavedAt = shallowRef<number | null>(null);
  const error = shallowRef<unknown | null>(null);

  let revision = 0;
  let savedRevision = 0;
  let handledRevision = 0;
  // Prevents an in-flight success from overwriting an error reported while it awaited.
  let errorEpoch = 0;
  let pauseDepth = 0;
  let disposed = false;
  let invokingSaveSynchronously = false;
  let inFlight: Promise<void> | null = null;
  let activeController: AbortController | null = null;
  const activeFlushes = new Set<Promise<void>>();

  const createDisposedError = (): Error =>
    new Error('[useAutoSave] Scope was disposed before flush completed.');

  const reportError = (failure: unknown): void => {
    // Each ref write may synchronously trigger a watcher that disposes this scope.
    // Recheck after every write so onError never runs after disposal.
    if (disposed) return;
    errorEpoch += 1;
    error.value = failure;
    if (disposed) return;
    status.value = 'error';
    if (disposed) return;
    if (onError) {
      try {
        onError(failure);
      } catch (onErrorFailure) {
        console.error('[useAutoSave] Error handler failed.', onErrorFailure);
      }
    }
  };

  const readValue = <Value>(value: MaybeRefOrGetter<Value>): Value => {
    try {
      return toValue(value);
    } catch (failure) {
      reportError(failure);
      throw failure;
    }
  };

  const performSave = async (): Promise<void> => {
    if (disposed) throw createDisposedError();

    const savingRevision = revision;
    const startingErrorEpoch = errorEpoch;
    let value: T;
    let controller: AbortController | null = null;

    try {
      value = toValue(source);

      controller = new AbortController();
      activeController = controller;
      status.value = 'saving';
      if (disposed) throw createDisposedError();
      error.value = null;
      if (disposed) throw createDisposedError();

      let saveResult: void | Promise<void>;
      invokingSaveSynchronously = true;
      try {
        saveResult = save(value, controller.signal);
      } finally {
        invokingSaveSynchronously = false;
      }
      await saveResult;
      if (disposed) throw createDisposedError();

      savedRevision = Math.max(savedRevision, savingRevision);
      handledRevision = Math.max(handledRevision, savingRevision);
      lastSavedAt.value = Date.now();
      if (disposed) throw createDisposedError();
      if (onSuccess) {
        try {
          onSuccess(value);
        } catch (onSuccessFailure) {
          console.error('[useAutoSave] Success handler failed.', onSuccessFailure);
        }
      }
      if (disposed) throw createDisposedError();
      if (errorEpoch === startingErrorEpoch) {
        status.value = handledRevision < revision ? 'pending' : 'saved';
      }
    } catch (failure) {
      if (!disposed) {
        handledRevision = Math.max(handledRevision, savingRevision);
        reportError(failure);
      }
      throw failure;
    } finally {
      if (activeController === controller) activeController = null;
    }
  };

  const getOrStartSave = (): Promise<void> => {
    if (inFlight) return inFlight;

    // Defer one microtask to coalesce same-tick synchronous changes into this save
    // and avoid re-entry into performSave's synchronous section.
    const task = Promise.resolve().then(performSave);
    inFlight = task;
    onSettled(task, () => {
      if (inFlight === task) inFlight = null;
    });
    return task;
  };

  const discardThrough = (targetRevision: number): void => {
    if (disposed) return;
    handledRevision = Math.max(handledRevision, targetRevision);
    if (!inFlight && status.value === 'pending') {
      status.value = lastSavedAt.value === null ? 'idle' : 'saved';
    }
  };

  const drainThrough = async (
    targetRevision: number,
    automatic = false,
    generation?: number,
  ): Promise<void> => {
    const isComplete = () => (automatic ? handledRevision : savedRevision) >= targetRevision;

    const stopIfDisposed = (): boolean => {
      if (!disposed) return false;
      if (automatic) return true;
      throw createDisposedError();
    };

    if (stopIfDisposed()) return;
    while (!isComplete()) {
      if (stopIfDisposed()) return;
      if (automatic) {
        if (generation !== autoSaveGeneration) return;
        const enabledValue = readValue(enabled);
        if (stopIfDisposed()) return;
        if (pauseDepth > 0 || !enabledValue) {
          discardThrough(targetRevision);
          return;
        }
      }
      try {
        await getOrStartSave();
      } catch (failure) {
        if (
          !automatic ||
          disposed ||
          generation !== autoSaveGeneration ||
          handledRevision >= targetRevision
        ) {
          throw failure;
        }
      }
      if (stopIfDisposed()) return;
    }
    stopIfDisposed();
  };

  let autoSaveGeneration = 0;
  const saveTimer = useTimeoutFn(
    () => {
      const targetRevision = revision;
      const generation = autoSaveGeneration;
      void drainThrough(targetRevision, true, generation).catch(() => {
        // 自动保存没有 Promise 消费方；失败已由 error/onError 暴露。
      });
    },
    debounceMs,
    { immediate: false },
  );

  const cancelScheduledSave = (): void => {
    autoSaveGeneration += 1;
    saveTimer.stop();
  };

  const startSaveTimer = (): void => {
    try {
      saveTimer.start();
    } catch (failure) {
      cancelScheduledSave();
      reportError(failure);
      throw failure;
    }
  };

  const scheduleSave = (): void => {
    if (disposed) return;
    autoSaveGeneration += 1;
    startSaveTimer();
  };

  watchReadable(
    () => toValue(debounceMs),
    () => {
      if (disposed || !saveTimer.isPending.value) return;
      saveTimer.stop();
      startSaveTimer();
    },
    (failure) => {
      cancelScheduledSave();
      reportError(failure);
    },
  );

  watchReadable(
    () => toValue(enabled),
    (value) => {
      if (!value) {
        cancelScheduledSave();
        discardThrough(revision);
      }
    },
    (failure) => {
      cancelScheduledSave();
      reportError(failure);
    },
  );

  watchReadable(
    () => toValue(source),
    () => {
      if (disposed || pauseDepth > 0) return;
      revision += 1;
      const enabledValue = readValue(enabled);
      if (!enabledValue) return;
      if (!inFlight) status.value = 'pending';
      scheduleSave();
    },
    (failure) => {
      cancelScheduledSave();
      reportError(failure);
    },
    { deep: true },
  );

  const flush = (): Promise<void> => {
    if (disposed) return Promise.reject(createDisposedError());

    if (invokingSaveSynchronously) {
      const failure = new Error('[useAutoSave] flush cannot be called from the save callback.');
      reportError(failure);
      return Promise.reject(failure);
    }

    cancelScheduledSave();
    if (pauseDepth > 0) {
      const failure = new Error('[useAutoSave] Cannot flush while auto-save is paused.');
      reportError(failure);
      return Promise.reject(failure);
    }

    const targetRevision = revision;
    const operation = (async () => {
      await drainThrough(targetRevision);
      if (disposed) throw createDisposedError();
    })();

    activeFlushes.add(operation);
    onSettled(operation, () => {
      activeFlushes.delete(operation);
    });
    return operation;
  };

  const withPaused = async <R>(task: () => R | Promise<R>): Promise<R> => {
    if (disposed) throw createDisposedError();
    if (invokingSaveSynchronously) {
      const failure = new Error(
        '[useAutoSave] withPaused cannot be called from the save callback.',
      );
      reportError(failure);
      throw failure;
    }

    pauseDepth += 1;
    cancelScheduledSave();
    discardThrough(revision);
    try {
      if (activeFlushes.size > 0) {
        const results = await Promise.allSettled([...activeFlushes]);
        const rejected = results.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        );
        if (rejected) {
          throw rejected.reason;
        }
      }
      if (inFlight) await inFlight;
      if (disposed) throw createDisposedError();
      return await task();
    } finally {
      pauseDepth -= 1;
    }
  };

  tryOnScopeDispose(() => {
    disposed = true;
    activeController?.abort();
    activeController = null;
    cancelScheduledSave();
  });

  return {
    status: readonly(status),
    lastSavedAt: readonly(lastSavedAt),
    error: readonly(error),
    flush,
    withPaused,
  };
}
