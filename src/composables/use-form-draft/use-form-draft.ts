import { readonly, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import {
  defaultWindow,
  tryOnScopeDispose,
  useTimeoutFn,
  type ConfigurableWindow,
} from '@vueuse/core';
import { isPlainObject, isString } from 'es-toolkit';
import { watchReadable } from '../shared/watch-readable';

export interface UseFormDraftOptions<
  T extends object = Record<string, unknown>,
> extends ConfigurableWindow {
  /** Whether form changes may currently be persisted. */
  enabled?: MaybeRefOrGetter<boolean>;
  /** Values shallowly merged below a restored draft. */
  defaults?: MaybeRefOrGetter<Partial<T>>;
  /** Delay before persisting form changes. */
  debounceMs?: MaybeRefOrGetter<number>;
  /** Receives key, serialization, and storage failures. */
  onError?: (error: unknown) => void;
}

export interface UseFormDraftReturn {
  /** Last draft operation failure. */
  error: Readonly<Ref<unknown | null>>;
  /** Whether a form change is waiting for its debounce window. */
  isPending: Readonly<Ref<boolean>>;
  /** Restores and shallowly merges the draft stored under the current key. */
  restore: () => boolean;
  /** Removes the draft stored under the current key. */
  clear: () => boolean;
  /** Cancels the debounce and immediately persists the current form. */
  flush: () => boolean;
  /** Ignores form changes while an operation runs; nested calls are supported. */
  withPaused: <R>(task: () => R | Promise<R>) => Promise<R>;
}

/**
 * Persists a form draft in localStorage for crash and refresh recovery.
 *
 * Restoring is explicit so local data cannot silently overwrite server data.
 *
 * @param form Mutable form state persisted as one JSON object.
 * @param key Complete localStorage key. Key changes never restore or migrate data.
 *
 * @example
 * const { restore, clear } = useFormDraft(form, 'order:draft')
 * onMounted(restore)
 */
export function useFormDraft<T extends object = Record<string, unknown>>(
  form: Ref<T>,
  key: MaybeRefOrGetter<string>,
  options: UseFormDraftOptions<T> = {},
): UseFormDraftReturn {
  const { window = defaultWindow, enabled = true, defaults, debounceMs = 500, onError } = options;

  const error = shallowRef<unknown | null>(null);
  let pauseDepth = 0;
  let disposed = false;
  const createDisposedError = (): Error => new Error('[useFormDraft] Scope was disposed.');

  const reportError = (failure: unknown): false => {
    if (disposed) return false;
    error.value = failure;
    if (disposed) return false;
    if (onError) {
      try {
        onError(failure);
      } catch (onErrorFailure) {
        console.error('[useFormDraft] Error handler failed.', onErrorFailure);
      }
    }
    return false;
  };

  const reportAndThrow = (failure: unknown): never => {
    reportError(failure);
    throw failure;
  };

  const readValue = <Value>(value: MaybeRefOrGetter<Value>): Value => {
    try {
      return toValue(value);
    } catch (failure) {
      return reportAndThrow(failure);
    }
  };

  const resolveKey = (): string => {
    const value = readValue(key);
    if (!isString(value) || value.trim().length === 0) {
      return reportAndThrow(new TypeError('[useFormDraft] "key" must be a non-empty string.'));
    }
    return value.trim();
  };

  const resolveStorage = (): Storage | null => {
    try {
      const storage = window?.localStorage;
      if (!storage) {
        throw new Error('[useFormDraft] localStorage is unavailable.');
      }
      return storage;
    } catch (failure) {
      reportError(failure);
      return null;
    }
  };

  const serializeForm = (): string => {
    if (!isPlainObject(form.value)) {
      return reportAndThrow(new TypeError('[useFormDraft] Form value must be a plain object.'));
    }
    let serialized: string | undefined;
    try {
      serialized = JSON.stringify(form.value);
    } catch (failure) {
      return reportAndThrow(failure);
    }
    if (serialized === undefined) {
      return reportAndThrow(new TypeError('[useFormDraft] Form cannot be serialized as JSON.'));
    }
    return serialized;
  };

  // The key watcher cancels reactive changes synchronously; expectedKey prevents stale writes for non-reactive getters it cannot observe.
  const writeDraft = (expectedKey?: string): boolean => {
    if (disposed || pauseDepth > 0) return false;
    const enabledValue = readValue(enabled);
    if (!enabledValue) return false;
    const currentKey = resolveKey();
    if (expectedKey !== undefined && expectedKey !== currentKey) return false;
    const serialized = serializeForm();
    const storage = resolveStorage();
    if (!storage) return false;
    try {
      storage.setItem(currentKey, serialized);
      error.value = null;
      return true;
    } catch (failure) {
      return reportError(failure);
    }
  };

  let scheduledKey: string | null = null;
  const draftTimer = useTimeoutFn(
    () => {
      const expectedKey = scheduledKey;
      scheduledKey = null;
      if (expectedKey !== null) writeDraft(expectedKey);
    },
    debounceMs,
    { immediate: false },
  );

  const cancelScheduledDraft = (): void => {
    scheduledKey = null;
    draftTimer.stop();
  };

  const startDraftTimer = (): void => {
    try {
      draftTimer.start();
    } catch (failure) {
      cancelScheduledDraft();
      reportAndThrow(failure);
    }
  };

  const scheduleDraft = (): void => {
    if (disposed || pauseDepth > 0) return;
    try {
      const enabledValue = readValue(enabled);
      if (!enabledValue) return;
      scheduledKey = resolveKey();
    } catch (failure) {
      cancelScheduledDraft();
      throw failure;
    }
    startDraftTimer();
  };

  watchReadable(
    () => toValue(debounceMs),
    () => {
      if (disposed || !draftTimer.isPending.value) return;
      draftTimer.stop();
      startDraftTimer();
    },
    (failure) => {
      cancelScheduledDraft();
      reportError(failure);
    },
  );

  const restore = (): boolean => {
    if (disposed) return false;
    cancelScheduledDraft();
    const currentKey = resolveKey();
    const storage = resolveStorage();
    if (!storage) return false;

    let raw: string | null;
    try {
      raw = storage.getItem(currentKey);
    } catch (failure) {
      return reportError(failure);
    }
    if (raw === null) {
      error.value = null;
      return false;
    }

    let draft: unknown;
    try {
      draft = JSON.parse(raw);
    } catch (failure) {
      return reportError(failure);
    }
    if (!isPlainObject(draft)) {
      return reportError(new TypeError('[useFormDraft] Stored draft must be a plain object.'));
    }

    const fallback = defaults === undefined ? {} : readValue(defaults);
    if (!isPlainObject(fallback)) {
      return reportAndThrow(new TypeError('[useFormDraft] "defaults" must be a plain object.'));
    }

    pauseDepth += 1;
    try {
      form.value = { ...fallback, ...draft } as T;
    } finally {
      pauseDepth -= 1;
    }
    error.value = null;
    return true;
  };

  const clear = (): boolean => {
    if (disposed) return false;
    cancelScheduledDraft();
    const currentKey = resolveKey();
    const storage = resolveStorage();
    if (!storage) return false;
    try {
      storage.removeItem(currentKey);
      error.value = null;
      return true;
    } catch (failure) {
      return reportError(failure);
    }
  };

  const flush = (): boolean => {
    if (disposed) return false;
    cancelScheduledDraft();
    return writeDraft();
  };

  const withPaused = async <R>(task: () => R | Promise<R>): Promise<R> => {
    if (disposed) throw createDisposedError();
    pauseDepth += 1;
    cancelScheduledDraft();
    try {
      if (disposed) throw createDisposedError();
      return await task();
    } finally {
      pauseDepth -= 1;
    }
  };

  watch(form, scheduleDraft, {
    deep: true,
    flush: 'sync',
  });
  watchReadable(
    resolveKey,
    () => {
      cancelScheduledDraft();
      if (disposed) return;
      error.value = null;
    },
    cancelScheduledDraft,
  );
  watchReadable(
    () => toValue(enabled),
    (value) => {
      if (!value) cancelScheduledDraft();
    },
    (failure) => {
      cancelScheduledDraft();
      reportError(failure);
    },
  );

  tryOnScopeDispose(() => {
    disposed = true;
    cancelScheduledDraft();
  });

  return {
    error: readonly(error),
    isPending: draftTimer.isPending,
    restore,
    clear,
    flush,
    withPaused,
  };
}
