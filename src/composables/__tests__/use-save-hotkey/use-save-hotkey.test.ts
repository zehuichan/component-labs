import {
  Fragment,
  Suspense,
  Teleport,
  createApp,
  effectScope,
  h,
  nextTick,
  onBeforeMount,
  onMounted,
  ref,
  type App,
  type Component,
} from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useSaveHotkey,
  type SaveHotkeyHandler,
  type UseSaveHotkeyOptions,
} from '../../use-save-hotkey/use-save-hotkey';

interface MountedHotkey {
  app: App;
  host: HTMLElement;
  target: Element;
  unmount: () => void;
}

function mountRoot(
  root: Component,
  selectTarget: (host: HTMLElement) => Element | null,
  handleError?: (failure: unknown) => void,
): MountedHotkey {
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp(root);
  if (handleError) app.config.errorHandler = handleError;
  app.mount(host);

  const target = selectTarget(host);
  if (!target) throw new Error('hotkey component did not render');

  return {
    app,
    host,
    target,
    unmount: () => {
      app.unmount();
      host.remove();
    },
  };
}

/** Mirrors the positional signature while keeping the tests declarative. */
type HotkeySetup = UseSaveHotkeyOptions & { handler: SaveHotkeyHandler };

function mountHotkey(
  { handler, ...options }: HotkeySetup,
  handleError?: (failure: unknown) => void,
): MountedHotkey {
  return mountRoot(
    {
      setup() {
        useSaveHotkey(handler, options);
        return () => h('button', 'Save');
      },
    },
    (host) => host.firstElementChild,
    handleError,
  );
}

function createNestedRoot(
  { handler: parentHandler, ...parentOptions }: HotkeySetup,
  { handler: childHandler, ...childOptions }: HotkeySetup,
): Component {
  const Child = {
    setup() {
      useSaveHotkey(childHandler, childOptions);
      return () => h('button', 'Child');
    },
  };
  return {
    setup() {
      useSaveHotkey(parentHandler, parentOptions);
      return () => h('div', [h(Child)]);
    },
  };
}

function dispatchSave(target: Element, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 's',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe('useSaveHotkey', () => {
  const mounted: MountedHotkey[] = [];

  afterEach(() => {
    for (const item of mounted.splice(0)) item.unmount();
    vi.restoreAllMocks();
  });

  it('fails fast without an active pre-mount component scope', () => {
    const scope = effectScope();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => {
      scope.run(() => useSaveHotkey(vi.fn()));
    }).toThrow('[useSaveHotkey]');

    scope.stop();
    expect(warn).not.toHaveBeenCalled();
  });

  it('handles Ctrl/Cmd+S and ignores modified or repeated shortcuts', async () => {
    const handler = vi.fn();
    const item = mountHotkey({ handler });
    mounted.push(item);

    const ctrlEvent = dispatchSave(item.target);
    expect(ctrlEvent.defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    await Promise.resolve();

    dispatchSave(item.target, { ctrlKey: false, metaKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
    await Promise.resolve();

    dispatchSave(item.target, { altKey: true });
    dispatchSave(item.target, { shiftKey: true });
    dispatchSave(item.target, { repeat: true });
    dispatchSave(item.target, { key: 'x' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('keeps a disabled top entry registered while blocking its handler', () => {
    const enabled = ref(false);
    const handler = vi.fn();
    const item = mountHotkey({ handler, enabled });
    mounted.push(item);

    const disabledEvent = dispatchSave(item.target);
    expect(disabledEvent.defaultPrevented).toBe(true);
    expect(handler).not.toHaveBeenCalled();

    enabled.value = true;
    dispatchSave(item.target);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('unregisters while inactive and registers again when reactivated', () => {
    const active = ref(false);
    const handler = vi.fn();
    const item = mountHotkey({ handler, active });
    mounted.push(item);

    const inactiveEvent = dispatchSave(item.target);
    expect(inactiveEvent.defaultPrevented).toBe(false);
    expect(handler).not.toHaveBeenCalled();

    active.value = true;
    const activeEvent = dispatchSave(item.target);
    expect(activeEvent.defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not overlap an asynchronous handler', async () => {
    let finish!: () => void;
    const operation = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const handler = vi.fn(() => operation);
    const item = mountHotkey({ handler });
    mounted.push(item);

    dispatchSave(item.target);
    dispatchSave(item.target);
    expect(handler).toHaveBeenCalledOnce();

    finish();
    await operation;
    await Promise.resolve();

    dispatchSave(item.target);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('keeps the busy state while an active registration is replaced', async () => {
    const active = ref(true);
    let finish!: () => void;
    const operation = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const handler = vi.fn(() => operation);
    const item = mountHotkey({ handler, active });
    mounted.push(item);

    dispatchSave(item.target);
    active.value = false;
    active.value = true;
    dispatchSave(item.target);
    expect(handler).toHaveBeenCalledOnce();

    finish();
    await operation;
    await Promise.resolve();

    dispatchSave(item.target);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('reports handler failures and releases the busy state', async () => {
    const failure = new Error('save failed');
    const onError = vi.fn();
    const handler = vi
      .fn<() => void | Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce();
    const item = mountHotkey({ handler, onError });
    mounted.push(item);

    dispatchSave(item.target);
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(failure);

    dispatchSave(item.target);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('removes registration on active getter failure and restores it', async () => {
    const failure = new Error('active failed');
    const shouldFail = ref(false);
    const renderTick = ref(0);
    const onError = vi.fn();
    const handler = vi.fn();
    const item = mountRoot(
      {
        setup() {
          useSaveHotkey(handler, {
            active: () => {
              if (shouldFail.value) throw failure;
              return true;
            },
            onError,
          });
          return () => h('button', String(renderTick.value));
        },
      },
      (host) => host.firstElementChild,
      () => undefined,
    );
    mounted.push(item);

    shouldFail.value = true;
    renderTick.value += 1;
    await nextTick();
    const failedEvent = dispatchSave(item.target);
    expect(failedEvent.defaultPrevented).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure);

    shouldFail.value = false;
    const recoveredEvent = dispatchSave(item.target);
    expect(recoveredEvent.defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('keeps a disabled deeper entry above its enabled parent', () => {
    const childActive = ref(true);
    const parentHandler = vi.fn();
    const childHandler = vi.fn();
    const item = mountRoot(
      createNestedRoot(
        { handler: parentHandler },
        { handler: childHandler, enabled: false, active: childActive },
      ),
      (host) => host.querySelector('button'),
    );
    mounted.push(item);

    const blockedEvent = dispatchSave(item.target);
    expect(blockedEvent.defaultPrevented).toBe(true);
    expect(parentHandler).not.toHaveBeenCalled();
    expect(childHandler).not.toHaveBeenCalled();

    childActive.value = false;
    dispatchSave(item.target);
    expect(parentHandler).toHaveBeenCalledOnce();
  });

  it('registers a Fragment root on its initial mount', () => {
    const handler = vi.fn();
    const item = mountRoot(
      {
        setup() {
          useSaveHotkey(handler);
          return () => h(Fragment, [h('button', { id: 'first' }, 'First'), h('button', 'Second')]);
        },
      },
      (host) => host.querySelector('#first'),
    );
    mounted.push(item);

    const event = dispatchSave(item.target);
    expect(event.defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('owns shortcuts from a Teleport root', () => {
    const teleportHost = document.createElement('div');
    document.body.append(teleportHost);
    const handler = vi.fn();
    const item = mountRoot(
      {
        setup() {
          useSaveHotkey(handler);
          return () => h(Teleport, { to: teleportHost }, [h('button', 'Teleported')]);
        },
      },
      () => teleportHost.querySelector('button'),
    );
    const unmount = item.unmount;
    item.unmount = () => {
      unmount();
      teleportHost.remove();
    };
    mounted.push(item);

    const event = dispatchSave(item.target);
    expect(event.defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('keeps a Teleport owned by its source app across another app container', () => {
    const sourceHandler = vi.fn();
    const targetHandler = vi.fn();
    const targetApp = mountHotkey({ handler: targetHandler });
    const sourceApp = mountRoot(
      {
        setup() {
          useSaveHotkey(sourceHandler);
          return () =>
            h(Teleport, { to: targetApp.host }, [
              h('button', { class: 'cross-app-teleport' }, 'Teleported'),
            ]);
        },
      },
      () => targetApp.host.querySelector('.cross-app-teleport'),
    );
    mounted.push(sourceApp, targetApp);

    const event = dispatchSave(sourceApp.target);

    expect(event.defaultPrevented).toBe(true);
    expect(sourceHandler).toHaveBeenCalledOnce();
    expect(targetHandler).not.toHaveBeenCalled();
  });

  it('owns shortcuts from a nested Teleport', () => {
    const teleportHost = document.createElement('div');
    document.body.append(teleportHost);
    const handler = vi.fn();
    const item = mountRoot(
      {
        setup() {
          useSaveHotkey(handler);
          return () =>
            h('div', [
              h('span', 'Local'),
              h(Teleport, { to: teleportHost }, [h('button', 'Teleported')]),
            ]);
        },
      },
      () => teleportHost.querySelector('button'),
    );
    const unmount = item.unmount;
    item.unmount = () => {
      unmount();
      teleportHost.remove();
    };
    mounted.push(item);

    const event = dispatchSave(item.target);
    expect(event.defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('discovers a Teleport added by a child-only update', async () => {
    const teleportHost = document.createElement('div');
    document.body.append(teleportHost);
    const visible = ref(false);
    const handler = vi.fn();
    const Child = {
      setup() {
        return () =>
          visible.value
            ? h(Teleport, { to: teleportHost }, [h('button', 'Teleported')])
            : h('span', 'Local');
      },
    };
    const item = mountRoot(
      {
        setup() {
          useSaveHotkey(handler);
          return () => h('div', [h(Child)]);
        },
      },
      (host) => host.firstElementChild,
    );
    const unmount = item.unmount;
    item.unmount = () => {
      unmount();
      teleportHost.remove();
    };
    mounted.push(item);

    visible.value = true;
    await nextTick();
    const target = teleportHost.querySelector('button');
    if (!target) throw new Error('dynamic Teleport did not render');

    const event = dispatchSave(target);
    expect(event.defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('owns a Teleport rendered through Suspense', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const teleportHost = document.createElement('div');
    document.body.append(teleportHost);
    const handler = vi.fn();
    const item = mountRoot(
      {
        setup() {
          useSaveHotkey(handler);
          return () =>
            h(Suspense, null, {
              default: () => h(Teleport, { to: teleportHost }, [h('button', 'Teleported')]),
              fallback: () => h('span', 'Loading'),
            });
        },
      },
      () => teleportHost.querySelector('button'),
    );
    const unmount = item.unmount;
    item.unmount = () => {
      unmount();
      teleportHost.remove();
    };
    mounted.push(item);

    const event = dispatchSave(item.target);
    expect(event.defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('rejects registration started from onMounted', () => {
    let failure: unknown;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const item = mountRoot(
      {
        setup() {
          onMounted(() => {
            try {
              useSaveHotkey(vi.fn());
            } catch (error) {
              failure = error;
            }
          });
          return () => h('button', 'Late');
        },
      },
      (host) => host.firstElementChild,
    );
    mounted.push(item);

    expect(failure).toBeInstanceOf(Error);
    expect(warn).not.toHaveBeenCalled();
  });

  it('rejects registration started from onBeforeMount', () => {
    let failure: unknown;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const item = mountRoot(
      {
        setup() {
          onBeforeMount(() => {
            try {
              useSaveHotkey(vi.fn());
            } catch (error) {
              failure = error;
            }
          });
          return () => h('button', 'Before mount');
        },
      },
      (host) => host.firstElementChild,
    );
    mounted.push(item);

    expect(failure).toBeInstanceOf(Error);
    expect(warn).not.toHaveBeenCalled();
  });

  it('rejects registration started from the initial render', () => {
    let failure: unknown;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const item = mountRoot(
      {
        render() {
          try {
            useSaveHotkey(vi.fn());
          } catch (error) {
            failure = error;
          }
          return h('button', 'Render');
        },
      },
      (host) => host.firstElementChild,
    );
    mounted.push(item);

    expect(failure).toBeInstanceOf(Error);
    expect(warn).not.toHaveBeenCalled();
  });

  it('uses the most recently registered app for document-level events', async () => {
    const olderHandler = vi.fn();
    const newerHandler = vi.fn();
    const older = mountRoot(
      createNestedRoot({ handler: vi.fn() }, { handler: olderHandler }),
      (host) => host.querySelector('button'),
    );
    mounted.push(older);
    const newer = mountHotkey({ handler: newerHandler });
    mounted.push(newer);

    const localEvent = dispatchSave(older.target);
    expect(localEvent.defaultPrevented).toBe(true);
    expect(olderHandler).toHaveBeenCalledOnce();
    await Promise.resolve();

    const documentEvent = dispatchSave(document.body);
    expect(documentEvent.defaultPrevented).toBe(true);
    expect(newerHandler).toHaveBeenCalledOnce();
  });

  it('removes registration and the global listener on unmount', () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const handler = vi.fn();
    const item = mountHotkey({ handler });

    item.unmount();

    const event = dispatchSave(document.body);
    expect(event.defaultPrevented).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
