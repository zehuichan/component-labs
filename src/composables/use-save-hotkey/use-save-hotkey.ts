import {
  getCurrentInstance,
  getCurrentScope,
  onActivated,
  onDeactivated,
  onMounted,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';
import { tryOnScopeDispose } from '@vueuse/core';

import { registerSaveHotkey } from './save-hotkey-registry';

function asNode(value: unknown): Node | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as Node).nodeType !== 'number' ||
    typeof (value as Node).contains !== 'function'
  ) {
    return null;
  }
  return value as Node;
}

function asElement(value: unknown): Element | null {
  const node = asNode(value);
  return node?.nodeType === 1 ? (node as Element) : null;
}

function asAppScope(value: unknown): Node | null {
  const node = asNode(value);
  return node && [1, 11].includes(node.nodeType) ? node : null;
}

function collectRenderedElements(
  value: unknown,
  result: Element[] = [],
  collectRoot = true,
): Element[] {
  if (typeof value !== 'object' || value === null) return result;
  const vnode = value as {
    el?: unknown;
    type?: unknown;
    component?: { subTree?: unknown } | null;
    suspense?: { activeBranch?: unknown } | null;
    children?: unknown;
  };
  const element = asElement(vnode.el);
  if (element && collectRoot) {
    if (!result.includes(element)) result.push(element);
  }

  const isTeleport =
    typeof vnode.type === 'object' &&
    vnode.type !== null &&
    (vnode.type as { __isTeleport?: boolean }).__isTeleport === true;
  const collectChildren = isTeleport || (collectRoot && !element);

  collectRenderedElements(vnode.component?.subTree, result, collectChildren);
  collectRenderedElements(vnode.suspense?.activeBranch, result, collectChildren);
  if (Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      collectRenderedElements(child, result, collectChildren);
    }
  }
  return result;
}

/** Save operation shared with the primary save action. */
export type SaveHotkeyHandler = () => void | Promise<void>;

export interface UseSaveHotkeyOptions {
  /** Whether the registered entry may currently execute. */
  enabled?: MaybeRefOrGetter<boolean>;
  /** Whether a mounted page or dialog currently owns the shortcut. */
  active?: MaybeRefOrGetter<boolean>;
  /** Receives handler and reactive predicate failures. */
  onError?: (error: unknown) => void;
}

/**
 * Registers Ctrl/Cmd+S for the active component or KeepAlive instance.
 * Must run synchronously during component setup.
 *
 * Nested scopes outrank ancestors and same-depth registrations use LIFO
 * priority. A disabled owner intentionally blocks lower entries.
 *
 * @param handler Save operation shared with the primary save action.
 *
 * @example
 * useSaveHotkey(submit, { enabled: () => !pending.value })
 */
export function useSaveHotkey(
  handler: SaveHotkeyHandler,
  options: UseSaveHotkeyOptions = {},
): void {
  const { enabled = true, active = true, onError } = options;
  const instance = getCurrentInstance();
  // Reject bare effect scopes, post-mount hooks such as onMounted/onActivated,
  // lifecycle callbacks with a mismatched scope such as onBeforeMount, and the
  // initial render after Vue assigns render. Reflect.get accesses the internal
  // scope/render fields without widening the public instance type.
  if (
    !instance ||
    instance.isMounted ||
    getCurrentScope() !== Reflect.get(instance, 'scope') ||
    typeof Reflect.get(instance, 'render') === 'function'
  ) {
    throw new Error('[useSaveHotkey] must be called synchronously during component setup.');
  }
  const owner = instance.appContext.app;

  let priority = 0;
  let ancestor = instance.parent;
  while (ancestor) {
    priority += 1;
    ancestor = ancestor.parent;
  }

  let lifecycleActive = false;
  let appScope: Node | null = null;
  let unregister: (() => void) | null = null;
  const execution = { busy: false };

  const reportError = (error: unknown): void => {
    if (!onError) {
      console.error('[useSaveHotkey] Active predicate failed.', error);
      return;
    }
    try {
      onError(error);
    } catch (onErrorFailure) {
      console.error('[useSaveHotkey] Error handler failed.', onErrorFailure);
    }
  };

  const removeRegistration = () => {
    unregister?.();
    unregister = null;
  };

  /** 成功求值带递增版本，确保异常恢复为相同布尔值时仍会重新注册。 */
  let activeEvaluation = 0;
  let activeValue = false;
  const readActive = (): { value: boolean; evaluation: number } => {
    try {
      return {
        value: toValue(active),
        evaluation: ++activeEvaluation,
      };
    } catch (error) {
      activeValue = false;
      removeRegistration();
      reportError(error);
      throw error;
    }
  };

  activeValue = readActive().value;

  const resolveAppScope = (): Node | null => {
    const container = (instance.appContext.app as { _container?: unknown })._container;
    const root = asNode(instance.root.subTree?.el) ?? asNode(instance.root.vnode.el);
    return asAppScope(container) ?? asAppScope(root?.parentNode);
  };

  const resolveScopes = (fallback: Node | null): Node[] => {
    let current: typeof instance | null = instance;
    while (current) {
      const elements = collectRenderedElements(current.subTree);
      if (elements.length > 0) return elements;
      current = current.parent;
    }

    return fallback ? [fallback] : [];
  };

  const syncRegistration = () => {
    const shouldRegister = lifecycleActive && activeValue;
    if (!shouldRegister) {
      removeRegistration();
      return;
    }

    const nextAppScope = resolveAppScope();
    if (appScope !== nextAppScope) {
      removeRegistration();
      appScope = nextAppScope;
    }
    if (!appScope) return;
    if (unregister) return;

    unregister = registerSaveHotkey({
      handler,
      enabled: () => toValue(enabled),
      onError,
      resolveScopes: () => resolveScopes(appScope),
      owner,
      appScope,
      priority,
      execution,
    });
  };

  watch(
    readActive,
    (result) => {
      if (!result) return;
      activeValue = result.value;
      syncRegistration();
    },
    { flush: 'sync' },
  );

  const activate = () => {
    lifecycleActive = true;
    syncRegistration();
  };
  const deactivate = () => {
    lifecycleActive = false;
    removeRegistration();
    appScope = null;
  };

  onMounted(activate);
  onActivated(activate);
  onDeactivated(deactivate);
  tryOnScopeDispose(deactivate);
}
