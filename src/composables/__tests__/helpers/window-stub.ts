import { vi } from 'vitest';

export interface WindowStubOverrides {
  /** `href` assignments are captured instead of navigating. */
  location?: Partial<Location>;
  navigator?: Partial<Navigator>;
  wx?: WeixinJsSdk;
}

export interface WindowStub {
  /** Pass into a composable's `window` option. */
  window: Window;
  /** Receives every `window.location.href = ...` navigation. */
  navigate: ReturnType<typeof vi.fn<(value: string) => void>>;
}

/**
 * Layers overrides on top of the real test window, so composables taking
 * `ConfigurableWindow` can be driven without stubbing globals. Anything not
 * overridden (`addEventListener`, `history`, `crypto`) keeps working.
 */
export function createWindowStub(overrides: WindowStubOverrides = {}): WindowStub {
  const navigate = vi.fn<(value: string) => void>();
  const { location, ...rest } = overrides;

  const locationStub = location && {
    ...location,
    get href() {
      return location.href ?? '';
    },
    set href(value: string) {
      navigate(value);
    },
  };

  const stub = new Proxy(window, {
    get(target, property) {
      if (property === 'location' && locationStub) return locationStub;
      if (Object.hasOwn(rest, property)) return Reflect.get(rest, property);
      // Read with the real window as receiver so happy-dom's internal getters
      // don't re-enter this proxy.
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as unknown as Window;

  return { window: stub, navigate };
}
