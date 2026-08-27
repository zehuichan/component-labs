# Repository Guidelines

## Project Structure & Module Organization

Workbench is a Vue 3 + TypeScript + Vite playground for complex business data entry and field linkage. Application code lives under `src/`: `components/plus-table/` (enhanced table), `composables/` (reusable hooks such as `useEmitEffect`, form draft/auto-save), `views/` (PlusTable, ERP, and composable demos), `layouts/` (playground shell), `ui/` (shadcn-vue / Reka UI primitives), `styles/` (Tailwind tokens + SCSS), `router/`, and `api/`. Brand assets and previews sit in `docs/brand/`; design-system source of truth is root [`DESIGN.md`](DESIGN.md). Shared scripts live in `scripts/`. Prefer extending the closest existing module; keep demo routes under `src/views/<area>/` and reusable logic under `src/composables/` or `src/components/`.

## Build, Test, and Development Commands

Use Node.js ≥20.19 and pnpm ≥10 (`packageManager` pins pnpm 10.33.4). Install with `pnpm install` (runs `prepare` to enable husky). Run `pnpm dev` for the Vite playground (default http://localhost:8000). `pnpm build` type-checks then produces production assets; `pnpm preview` serves the build. `pnpm typecheck` runs `vue-tsc`. `pnpm test` runs Vitest (happy-dom). Format with `pnpm format`; check with `pnpm format:check`. Pre-commit runs `lint-staged` (Prettier on staged files). `pnpm clean` / `pnpm reinstall` reset local installs.

## Coding Style & Naming Conventions

Composables under `src/composables/` and browser helpers under `src/utils/` follow [vueuse/vueuse](https://github.com/vueuse/vueuse) conventions; the enforceable rules live in [`.cursor/rules/vueuse-composables.mdc`](.cursor/rules/vueuse-composables.mdc). In short: positional primary args with a trailing options object, exported `UseXxxOptions` / `UseXxxReturn`, object (not tuple) returns, `MaybeRefOrGetter` + `toValue`, `tryOnScopeDispose`, `ConfigurableWindow` instead of reaching for `window` / `import.meta.env`, and no import-time side effects.

We write Vue SFCs and TypeScript. Prettier enforces semicolons, single quotes, and trailing commas (auto-formatted on commit via husky + lint-staged; use `pnpm format` for a full-tree pass). Use `PascalCase` for components and classes, `camelCase` for variables/functions/composables (`useXxx`), and `SCREAMING_SNAKE_CASE` only for exported config constants. File names follow kebab-case (e.g., `use-auto-save.ts`, `playground-sidebar.vue`). Import via path aliases (`@/components`, `@/composables`, `@/ui`, `@/utils`) from `components.json`. For playground / brand / theme UI, read [`DESIGN.md`](DESIGN.md) first and keep tokens aligned with `src/styles/tailwind.css`; previews live at `docs/brand/preview.html`. Prefer existing shadcn-vue primitives under `src/ui/` over ad-hoc controls.

## Testing Guidelines

Unit tests use Vitest and live in colocated `__tests__` folders or `*.test.ts` files (e.g., `src/composables/__tests__/`, `src/components/plus-table/__tests__/`). Prefer descriptive names like `use-emit-effect.test.ts`. Cover new logic with `pnpm test`; include fixtures/helpers under `__tests__/helpers` when shared setup is needed. UI shell changes should update the matching layout tests under `src/layouts/__tests__/`.

## Commit & Pull Request Guidelines

Follow conventional commits (`type(scope): subject`) as seen in history (`feat(layouts): ...`, `feat(brand): ...`). Keep subjects imperative and ≤72 characters, with optional bodies for context. PRs must describe the change, link related issues/specs under `docs/superpowers/` when applicable, and attach before/after screenshots for UI updates. Confirm `pnpm typecheck` and `pnpm test` locally, note follow-ups, and keep diffs scoped to the request.
