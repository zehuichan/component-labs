import { removeToken, setToken } from './auth';

/**
 * 简版前端单点登录。
 *
 * 在 main.ts 引入即可：`import '@/utils/sso'`
 *
 * 本地测试：
 * `http://localhost:8000/?username=sso&roles=admin&accessToken=eyJhbGciOiJIUzUxMiJ9.demo`
 *
 * 判定为 SSO 后：
 * 1. 清空本地旧信息
 * 2. 把 URL 中的凭证写入本地
 * 3. 从 URL 去掉敏感参数
 * 4. `location.replace` 跳到干净地址
 */
const MUST = ['username', 'roles', 'accessToken'] as const;

function getQueryMap(href: string): Record<string, string> {
  const url = new URL(href);

  if (url.search.length > 1) {
    return Object.fromEntries(url.searchParams.entries());
  }

  const hash = url.hash;
  const q = hash.indexOf('?');
  if (q === -1) return {};
  return Object.fromEntries(new URLSearchParams(hash.slice(q + 1)).entries());
}

function buildCleanUrl(href: string, params: Record<string, string>): string {
  const url = new URL(href);
  const next = new URLSearchParams(params);
  for (const key of MUST) {
    next.delete(key);
  }
  const query = next.toString();

  const hash = url.hash;
  if (hash.includes('?')) {
    const hashPath = hash.slice(0, hash.indexOf('?'));
    url.search = '';
    url.hash = query ? `${hashPath}?${query}` : hashPath;
    return url.toString();
  }

  url.search = query ? `?${query}` : '';
  return url.toString();
}

export function sso() {
  const params = getQueryMap(location.href);
  if (!MUST.every((key) => params[key])) return;

  removeToken();
  setToken({
    accessToken: params.accessToken,
    username: params.username,
    roles: params.roles.split(/[,\s]+/).filter(Boolean),
  });

  location.replace(buildCleanUrl(location.href, params));
}

sso();
