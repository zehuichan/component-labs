import { defaultWindow, type ConfigurableWindow } from '@vueuse/core';
import { removeToken, setToken } from './auth';

// 三个都在才认定是 SSO 回调；清理时只抹敏感项，username 留着方便排查
const MUST = ['username', 'roles', 'accessToken'] as const;
const SENSITIVE = ['roles', 'accessToken'] as const;

export type SsoOptions = ConfigurableWindow;

interface Credentials {
  params: URLSearchParams;
  /** 凭证所在位置，决定清理哪一段 query，避免动到另一段 */
  from: 'search' | 'hash';
}

function getHashQuery(hash: string): URLSearchParams {
  const start = hash.indexOf('?');
  return new URLSearchParams(start === -1 ? '' : hash.slice(start + 1));
}

function readCredentials(url: URL): Credentials | null {
  const hashParams = getHashQuery(url.hash);
  if (MUST.every((key) => hashParams.get(key))) return { params: hashParams, from: 'hash' };
  if (MUST.every((key) => url.searchParams.get(key))) {
    return { params: url.searchParams, from: 'search' };
  }
  return null;
}

function buildCleanUrl(url: URL, { params, from }: Credentials): string {
  const next = new URLSearchParams(params);
  for (const key of SENSITIVE) {
    next.delete(key);
  }
  const query = next.toString();

  if (from === 'hash') {
    const hashPath = url.hash.slice(0, url.hash.indexOf('?'));
    url.hash = query ? `${hashPath}?${query}` : hashPath;
  } else {
    url.search = query ? `?${query}` : '';
  }

  return url.toString();
}

/**
 * Frontend single sign-on handoff.
 *
 * Detects a callback carrying `username`, `roles`, and `accessToken`, stores the
 * credentials locally, then replaces the URL with a copy that has the sensitive
 * params stripped. Works in both history and hash routing modes: the credentials
 * are read from whichever query string holds them, and only that one is cleaned.
 *
 * Local check (history mode):
 * `http://localhost:8000/?username=sso&roles=admin&accessToken=eyJhbGciOiJIUzUxMiJ9.demo`
 *
 * Hash mode, credentials trailing the route:
 * `http://localhost:8000/#/home?username=sso&roles=admin&accessToken=eyJhbGciOiJIUzUxMiJ9.demo`
 *
 * @returns whether the current URL was handled as an SSO callback.
 *
 * @example
 * import { sso } from '@/utils/sso'
 *
 * sso()
 * createApp(App).mount('#app')
 */
export function sso(options: SsoOptions = {}): boolean {
  const { window = defaultWindow } = options;
  if (!window) return false;

  const { location } = window;
  const url = new URL(location.href);
  const credentials = readCredentials(url);
  if (!credentials) return false;

  const { params } = credentials;
  removeToken();
  setToken({
    accessToken: params.get('accessToken')!,
    username: params.get('username')!,
    roles: params
      .get('roles')!
      .split(/[,\s]+/)
      .filter(Boolean),
  });

  location.replace(buildCleanUrl(url, credentials));
  return true;
}
