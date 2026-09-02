import { createHighlighter, type Highlighter } from 'shiki';

const LANG_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
};

const THEMES = ['github-light', 'github-dark'] as const;

export type CodeTheme = (typeof THEMES)[number];

export function resolveLang(lang: string): string {
  return LANG_ALIASES[lang] ?? lang;
}

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [...THEMES],
      langs: ['typescript', 'vue', 'javascript', 'json'],
    });
  }
  return highlighterPromise;
}

export async function highlightCode(
  code: string,
  lang = 'ts',
  theme: CodeTheme = 'github-light',
): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang: resolveLang(lang),
    theme,
  });
}
