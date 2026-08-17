---
version: alpha
name: Workbench-design-system
description: 'Dual-mode engineering playground for complex business data entry and field linkage. Light mode: white canvas (#ffffff) with neutral gray shell. Dark mode: ink canvas (#14181f) with charcoal surfaces — same quiet hierarchy, no neon glow. The single chromatic brand accent is Workbench Teal (#0b6e6e light / #2dd4bf for dark interactive text); the modular 2×2 mark stays teal-filled in both modes. UI type is Geist Sans; code uses Geist Mono / IBM Plex Mono. Depth from hairline borders and surface lifts. Logo is icon + wordmark.'

colors:
  primary: '#0b6e6e'
  on-primary: '#f2efe6'
  primary-hover: '#095858'
  primary-soft: '#d4ebea'
  primary-muted: '#0b6e6e33'
  ink: '#14181f'
  ink-soft: '#3a4250'
  ink-muted: '#737373'
  ink-subtle: '#a3a3a3'
  canvas: '#ffffff'
  surface-1: '#fafafa'
  surface-2: '#f4f4f5'
  surface-3: '#e5e5e5'
  paper: '#f2efe6'
  hairline: '#e5e5e5'
  hairline-strong: '#d4d4d4'
  sidebar: '#fafafa'
  sidebar-border: '#e5e5e580'
  mark-cell-1: '#f2efe6f2'
  mark-cell-2: '#f2efe68c'
  mark-cell-3: '#f2efe68c'
  mark-cell-4: '#f2efe647'
  semantic-success: '#166534'
  semantic-warning: '#b45309'
  semantic-danger: '#dc2626'
  semantic-info: '#0369a1'
  overlay: '#14181f66'
  inverse-canvas: '#1a1f28'
  inverse-ink: '#f2efe6'
  dark-primary: '#0b6e6e'
  dark-primary-bright: '#2dd4bf'
  dark-primary-hover: '#0f766e'
  dark-primary-soft: '#0b6e6e40'
  dark-on-primary: '#f2efe6'
  dark-ink: '#f2efe6'
  dark-ink-soft: '#c9c3b4'
  dark-ink-muted: '#a39c8c'
  dark-ink-subtle: '#6b6570'
  dark-canvas: '#14181f'
  dark-surface-1: '#1a1f28'
  dark-surface-2: '#222833'
  dark-surface-3: '#2a3140'
  dark-paper: '#f2efe6'
  dark-hairline: '#ffffff1a'
  dark-hairline-strong: '#ffffff26'
  dark-sidebar: '#1a1f28'
  dark-sidebar-border: '#ffffff14'
  dark-overlay: '#00000099'
  dark-code-canvas: '#0f1218'
  dark-semantic-success: '#4ade80'
  dark-semantic-warning: '#fbbf24'
  dark-semantic-danger: '#f87171'
  dark-semantic-info: '#38bdf8'

typography:
  display-xl:
    fontFamily: Geist Sans
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -1.2px
  display-lg:
    fontFamily: Geist Sans
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.8px
  heading-1:
    fontFamily: Geist Sans
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.5px
  heading-2:
    fontFamily: Geist Sans
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.3px
  heading-3:
    fontFamily: Geist Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.2px
  brand-wordmark:
    fontFamily: Sora
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -0.04em
  body-lg:
    fontFamily: Geist Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: -0.01em
  body:
    fontFamily: Geist Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: Geist Sans
    fontSize: 13.5px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  caption:
    fontFamily: Geist Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.02em
  eyebrow:
    fontFamily: IBM Plex Mono
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.08em
  nav-label:
    fontFamily: Geist Sans
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0
  nav-link:
    fontFamily: Geist Sans
    fontSize: 13.5px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 0
  button:
    fontFamily: Geist Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0
  mono:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  code:
    fontFamily: Geist Mono
    fontSize: 12.5px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
  xl: 14px
  mark: 14px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 8px 14px
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
  button-secondary:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 8px 14px
  button-ghost:
    backgroundColor: transparent
    textColor: '{colors.ink-soft}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    padding: 8px 12px
  sidebar-shell:
    backgroundColor: '{colors.sidebar}'
    textColor: '{colors.ink}'
    typography: '{typography.nav-link}'
    rounded: '{rounded.xs}'
  sidebar-group-label:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    typography: '{typography.nav-label}'
  sidebar-link:
    backgroundColor: transparent
    textColor: '{colors.ink-muted}'
    typography: '{typography.nav-link}'
    rounded: '{rounded.md}'
    padding: 8px 12px
    height: 36px
  sidebar-link-active:
    backgroundColor: transparent
    textColor: '{colors.primary}'
    typography: '{typography.nav-link}'
    rounded: '{rounded.md}'
  nav-category:
    backgroundColor: transparent
    textColor: '{colors.ink-muted}'
    typography: '{typography.nav-link}'
    padding: 8px 12px
  nav-category-active:
    backgroundColor: transparent
    textColor: '{colors.primary}'
    typography: '{typography.nav-link}'
  brand-lockup:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    typography: '{typography.brand-wordmark}'
  demo-card:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.lg}'
    padding: 16px
  code-block:
    backgroundColor: '{colors.inverse-canvas}'
    textColor: '{colors.inverse-ink}'
    typography: '{typography.code}'
    rounded: '{rounded.md}'
    padding: 16px
  text-input:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: 8px 12px
  text-input-focused:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
  status-badge:
    backgroundColor: '{colors.primary-soft}'
    textColor: '{colors.primary}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: 2px 8px
  table-surface:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.md}'
---

## Overview

Workbench is a **Vue 3 playground / workbench** for PlusTable, form composables, and ERP document-linkage demos. The visual system is **dual-mode and engineering-calm**: light white canvas or dark ink canvas, neutral shell, one teal accent, modular logo mark.

The brand mark is a **2×2 module grid inside a teal rounded square** — a “work seat” metaphor. The top-left cell is the active focus (highest opacity); the other cells step down. Wordmark is **Workbench** beside the mark (never inside it). Favicon uses the mark alone — the teal square reads on both light and dark browser chrome.

UI chrome (sidebar, header categories, demo pages) stays quiet so **tables, forms, and code samples** remain the protagonists. Prefer hairline borders and surface lifts over drop shadows. Avoid purple gradients, neon glow, and decorative card stacks in either mode.

**Key Characteristics:**

- **Workbench Teal** is the only brand chroma — mark fill `#0b6e6e`; dark-mode interactive text may use `{colors.dark-primary-bright}` (#2dd4bf) for WCAG contrast on ink canvas.
- Light: canvas `#ffffff` + sidebar `#fafafa`. Dark: canvas `{colors.dark-canvas}` (#14181f) + sidebar `{colors.dark-sidebar}` (#1a1f28).
- Toggle via `html.dark` / `.dark` (matches existing Tailwind `@custom-variant dark`).
- **Geist Sans** for product UI; **Sora SemiBold** for brand wordmark; **Geist Mono / IBM Plex Mono** for code and eyebrows.
- Logo: icon + wordmark; favicon = mark only (same asset both modes).
- Playground shell: always-open sidebar groups, top category nav with teal underline / text for active state.
- Depth via hairlines + soft surfaces; shadows only for floating overlays (dialogs / sheets).

## Brand mark

### Construction

- Outer: 64×64 viewBox, square with `{rounded.mark}` 14px corners, fill `{colors.primary}`.
- Inner modules: 2×2 rounded rects (~3.5px radius), gap consistent; opacities ≈ 95% / 55% / 55% / 28% on `{colors.paper}` (#f2efe6).
- Micro “edit tick” (工位横杠) on the active (top-left) cell is part of the default mark — keep it for favicon 32, sidebar (~22–24px), and README. Omit only at ≤16px where it turns to noise.
- Clear space around mark ≥ 12% of mark width.
- Do not rotate, outline-glow, or place the wordmark inside the square.

### Lockups

| Context              | Treatment                                                                     |
| -------------------- | ----------------------------------------------------------------------------- |
| Favicon / app icon   | Mark only (`public/favicon.svg`)                                              |
| Sidebar brand        | 22–24px mark + `{typography.brand-wordmark}` “Workbench”                      |
| README / docs header | 36–48px mark + wordmark; optional one-line subtitle in `{typography.caption}` |

### Color variants

- **Default (both modes)**: teal fill `{colors.primary}` + paper cells — preferred on light _and_ dark UI (mark is already high-contrast on ink canvas).
- **On-teal wordmark**: wordmark uses `{colors.ink}` in light, `{colors.dark-ink}` in dark — never teal-on-teal.
- **Inverse mark**: paper/white outer with teal cells — only for rare light-on-dark marketing bands; not the playground default.
- **Mono**: single ink/paper on transparent — print / watermark only.

## Colors

### Brand & Accent (shared)

- **Primary / Workbench Teal** (`{colors.primary}` #0b6e6e): Logo fill, primary buttons (both modes), light-mode active nav / focus.
- **Primary Hover** (`{colors.primary-hover}` / `{colors.dark-primary-hover}`): Pressed / hovered primary fills.
- **On Primary** (`{colors.on-primary}` / `{colors.dark-on-primary}`): Text on teal buttons — paper tint `#f2efe6`.
- **Dark Primary Bright** (`{colors.dark-primary-bright}` #2dd4bf): Dark-mode _text/icon_ accent (active nav, links, focus ring) when `#0b6e6e` on `#14181f` fails contrast. Do **not** recolor the logo fill to bright teal.

### Light surfaces & text

- **Canvas** (`{colors.canvas}`): Main content / demo stage.
- **Surface 1–3** (`{colors.surface-1}` … `{colors.surface-3}`): Nested panels, hover rows, disabled fills.
- **Sidebar** (`{colors.sidebar}`): Playground left rail.
- **Paper** (`{colors.paper}`): Logo cell color + brand warm neutral.
- **Hairline / Hairline Strong**: Borders and dividers.
- **Ink / Ink Soft / Muted / Subtle**: Text hierarchy on light canvas.
- **Inverse Canvas** (`{colors.inverse-canvas}`): Code blocks in light mode (stays dark).

### Dark surfaces & text

- **Dark Canvas** (`{colors.dark-canvas}` #14181f): Page floor — same ink used as light-mode text (paired inversion).
- **Dark Surface 1–3** (`{colors.dark-surface-1}` … `{colors.dark-surface-3}`): Cards, hover, elevated panels — step up from canvas, not pure black `#000`.
- **Dark Sidebar** (`{colors.dark-sidebar}` #1a1f28): Left rail; slightly lifted vs canvas.
- **Dark Hairline** (`{colors.dark-hairline}`): `white` @ ~10% — never solid gray that muddies the shell.
- **Dark Ink** (`{colors.dark-ink}` #f2efe6): Headlines / strong UI (paper tint, not pure `#fff`).
- **Dark Ink Soft / Muted / Subtle**: Secondary → tertiary text on dark.
- **Dark Code Canvas** (`{colors.dark-code-canvas}` #0f1218): Code blocks — one step _below_ dark canvas so they still read as “inset”.
- **Dark Primary Soft** (`{colors.dark-primary-soft}`): Badge / selected-row wash (`#0b6e6e` @ 25%).

### Semantic

- Light: `{colors.semantic-*}` as documented.
- Dark: `{colors.dark-semantic-*}` — slightly brighter for contrast; still never replace brand teal for chrome.

### Mode mapping (implementation)

| Role                   | Light token                      | Dark token (`html.dark`)                  |
| ---------------------- | -------------------------------- | ----------------------------------------- |
| Page background        | `{colors.canvas}`                | `{colors.dark-canvas}`                    |
| Sidebar                | `{colors.sidebar}`               | `{colors.dark-sidebar}`                   |
| Card / demo            | `{colors.canvas}` + hairline     | `{colors.dark-surface-1}` + dark-hairline |
| Primary button fill    | `{colors.primary}`               | `{colors.dark-primary}` (same hex)        |
| Active nav / link text | `{colors.primary}`               | `{colors.dark-primary-bright}`            |
| Focus ring             | `{colors.primary}`               | `{colors.dark-primary-bright}`            |
| Body text              | `{colors.ink}`                   | `{colors.dark-ink}`                       |
| Code block             | `{colors.inverse-canvas}`        | `{colors.dark-code-canvas}`               |
| Logo mark              | `{colors.primary}` + paper cells | **same** (do not invert by default)       |

Wire to existing shadcn CSS variables under `:root` / `.dark` in `src/styles/tailwind.css` (map `--background`, `--foreground`, `--sidebar*`, and brand `--playground-accent`).

> Migration note: playground previously used orange `#f54e00` as `--playground-accent`. Target: light `{colors.primary}`, dark interactive `{colors.dark-primary-bright}` (buttons stay `#0b6e6e`).

## Typography

### Font Family

- **Geist Sans** — product UI (already in `src/styles/tailwind.css`). Fallback: `system-ui, sans-serif`.
- **Sora** — brand wordmark lockup only. Fallback: Geist Sans 600.
- **Geist Mono** — code blocks, API names. Fallback: `IBM Plex Mono`, `ui-monospace`.
- **IBM Plex Mono** — eyebrows / spec labels in brand docs.

### Hierarchy

| Token                                     | Size      | Weight | Line Height | Letter Spacing | Use                            |
| ----------------------------------------- | --------- | ------ | ----------- | -------------- | ------------------------------ |
| `{typography.display-xl}`                 | 48px      | 600    | 1.1         | -1.2px         | Rare marketing / README heroes |
| `{typography.display-lg}`                 | 36px      | 600    | 1.15        | -0.8px         | Page titles                    |
| `{typography.heading-1}`                  | 28px      | 600    | 1.2         | -0.5px         | Demo page H1                   |
| `{typography.heading-2}`                  | 22px      | 600    | 1.25        | -0.3px         | Section titles                 |
| `{typography.heading-3}`                  | 18px      | 600    | 1.3         | -0.2px         | Card / block titles            |
| `{typography.brand-wordmark}`             | 18px      | 600    | 1           | -0.04em        | “Workbench” beside mark        |
| `{typography.body-lg}`                    | 16px      | 400    | 1.55        | -0.01em        | Lead paragraphs                |
| `{typography.body}`                       | 14px      | 400    | 1.5         | 0              | Default UI copy                |
| `{typography.body-sm}`                    | 13.5px    | 400    | 1.45        | 0              | Sidebar links, dense tables    |
| `{typography.caption}`                    | 12px      | 500    | 1.4         | 0.02em         | Meta, badges                   |
| `{typography.eyebrow}`                    | 11px      | 500    | 1.3         | 0.08em         | Uppercase section labels       |
| `{typography.button}`                     | 14px      | 500    | 1.2         | 0              | Buttons                        |
| `{typography.mono}` / `{typography.code}` | 12.5–13px | 400    | 1.5–1.55    | 0              | Code / tokens                  |

### Principles

- Hierarchy from **size + weight**, not a second display family in product UI.
- Slightly tight tracking on headings; body stays neutral.
- Mono only for code, paths, prop names — not for nav labels.

## Layout

### Spacing System

- Base unit **4px**.
- Tokens: `{spacing.xxs}` 4 → `{spacing.section}` 64.
- Sidebar link height **36px**; header category underline **2px**.
- Demo block padding typically `{spacing.md}`–`{spacing.lg}`.

### Grid & Shell

```text
SidebarProvider
├── Sidebar (collapsible none) — brand + grouped routes
└── SidebarInset
    ├── Header — category NavigationMenu
    └── main — router-view (demo stage)
```

- Content max width for docs-style pages ≈ 960–1120px; tables may go full inset width.
- Sidebar groups always expanded (no collapsible group chrome unless product requires it later).

### Whitespace Philosophy

Quiet density: enough air to scan ERP forms, tight enough to feel like a tool. Prefer one clear column of demo + API tables over card grids.

## Elevation & Depth

| Level       | Light                                       | Dark                                                  | Use                              |
| ----------- | ------------------------------------------- | ----------------------------------------------------- | -------------------------------- |
| 0 flat      | No shadow                                   | No shadow                                             | Body, sidebar, header            |
| 1 hairline  | 1px `{colors.hairline}`                     | 1px `{colors.dark-hairline}`                          | Demo blocks, table wraps, inputs |
| 2 soft lift | `{colors.surface-1}` / `{colors.surface-2}` | `{colors.dark-surface-2}` / `{colors.dark-surface-3}` | Hover rows, nested panels        |
| 3 overlay   | `{colors.overlay}` + soft shadow            | `{colors.dark-overlay}` + softer shadow               | Dialog / sheet only              |
| focus       | 2px `{colors.primary}` @ ~40%               | 2px `{colors.dark-primary-bright}` @ ~45%             | Focused controls                 |

Avoid multi-layer decorative shadows and colored glows (especially in dark mode).

## Shapes

| Token                             | Value  | Use                                                    |
| --------------------------------- | ------ | ------------------------------------------------------ |
| `{rounded.xs}`                    | 4px    | Tiny chips                                             |
| `{rounded.sm}`                    | 6px    | Dense tags                                             |
| `{rounded.md}`                    | 8px    | Buttons, inputs, sidebar links (`--radius` ≈ 0.625rem) |
| `{rounded.lg}`                    | 10px   | Demo cards                                             |
| `{rounded.xl}` / `{rounded.mark}` | 14px   | Logo outer square                                      |
| `{rounded.pill}`                  | 9999px | Status badges only                                     |

## Components

### Buttons

- **`button-primary`**: Teal fill `#0b6e6e` (both modes), paper/on-primary text, `{rounded.md}`, padding 8×14. Hover → `{colors.primary-hover}` / `{colors.dark-primary-hover}`.
- **`button-secondary`**: Light = canvas + hairline + ink. Dark = `{colors.dark-surface-2}` + dark-hairline + `{colors.dark-ink}`.
- **`button-ghost`**: Transparent; muted → ink (light) or dark-ink (dark) on hover.

### Navigation

- **`sidebar-shell`**: Light `{colors.sidebar}` / dark `{colors.dark-sidebar}`, right hairline.
- **`sidebar-group-label`**: Semibold ink / dark-ink.
- **`sidebar-link` / `sidebar-link-active`**: Idle muted; active text = `{colors.primary}` (light) or `{colors.dark-primary-bright}` (dark). Avoid filled active pills unless a11y requires.
- **`nav-category` / `nav-category-active`**: Active = same accent text + 2px underline in matching accent.

### Brand

- **`brand-lockup`**: Same teal mark both modes; wordmark ink ↔ dark-ink. Optional theme toggle control sits near header, not inside the lockup.

### Surfaces

- **`demo-card`**: Light canvas / dark-surface-1 + matching hairline, `{rounded.lg}`.
- **`code-block`**: Light → `{colors.inverse-canvas}`; dark → `{colors.dark-code-canvas}`; mono type. Prefer a dark Shiki theme in dark mode.
- **`table-surface`**: Dense tables; row hairlines use mode hairline token.

### Inputs

- **`text-input`**: Mode canvas/surface fill + hairline, `{rounded.md}`.
- **`text-input-focused`**: Focus ring uses light primary / dark-primary-bright.

### Status

- **`status-badge`**: Light `{colors.primary-soft}` + primary text; dark `{colors.dark-primary-soft}` + `{colors.dark-primary-bright}` text.

## Dark mode

### Philosophy

Dark mode is a **paired inversion of surfaces**, not a second brand. Keep the same spacing, radius, type, and teal mark. Raise interactive teal to `{colors.dark-primary-bright}` for text/focus only. No aurora gradients, no teal glow, no pure `#000` canvas.

### Activation

- Class strategy: `document.documentElement.classList.toggle('dark')` (Tailwind v4 `@custom-variant dark (&:is(.dark *))`).
- Product / playground chrome ships **light-only** for now. Re-enable later with `html.dark` + header toggle if adaptation is ready.
- Marketing pages may scope `.dark` to a **section** to build an ink band (home hero, closing CTA). The band inherits the paired dark tokens, so teal stays a rim light — never a full-page wash. The site header adds `.dark` while it rides on such a band.
- Brand preview (`docs/brand/preview.html`) may still demo dark for design review.

### Contrast checks

- Body text `{colors.dark-ink}` on `{colors.dark-canvas}` ≥ WCAG AA.
- Active nav `{colors.dark-primary-bright}` on dark canvas / sidebar ≥ AA for text.
- Primary button: paper text on `#0b6e6e` (verify; if failing, darken hover only — do not wash the fill to bright teal).
- Hairlines at 10–15% white; if a control disappears, bump to `{colors.dark-hairline-strong}`.

### What flips vs what stays

| Stays                          | Flips                                         |
| ------------------------------ | --------------------------------------------- |
| Logo mark geometry + teal fill | Canvas, sidebar, card fills                   |
| Radius, spacing, type scale    | Ink → dark-ink hierarchy                      |
| Primary button fill `#0b6e6e`  | Active link / underline / focus → bright teal |
| Favicon SVG                    | Code block theme (Shiki)                      |

## Do's and Don'ts

### Do

- Use teal sparsely: mark, active nav, focus, primary CTA, critical links.
- In dark mode, use bright teal for **text/focus**, deep teal for **fills/mark**.
- Keep playground shell neutral so demos dominate (both modes).
- Ship one SVG mark; prefer SVG favicon.
- Map both `:root` and `.dark` semantic tokens together when theming.
- Preserve modular 2×2 opacity ladder in the logo.

### Don't

- Don't use purple-on-white / indigo glow / neon dark aesthetics.
- Don't make teal a full-page background wash in either mode.
- Don't put wordmark inside the mark square.
- Don't invert the logo to paper-fill by default in dark mode.
- Don't use true `#000000` as dark canvas.
- Don't add icon-per-nav-item clutter unless a feature explicitly needs it.
- Don't rely on heavy card chrome for every demo section.
- Don't reintroduce orange `#f54e00` as brand accent after migration.
- Don't ship dark mode by only inverting with `filter` / automatic color-scheme hacks.

## Responsive Behavior

### Breakpoints

| Name    | Width      | Key Changes                                                      |
| ------- | ---------- | ---------------------------------------------------------------- |
| Desktop | ≥1024px    | Full sidebar + header categories                                 |
| Tablet  | 768–1023px | Sidebar may compress; demos stack                                |
| Mobile  | <768px     | Prefer sheet / offcanvas for nav if enabled; single-column demos |

### Touch Targets

- Nav links and buttons ≥ 36px height; primary actions ≥ 40px on touch.

### Collapsing Strategy

- Default playground: `collapsible="none"`. If mobile nav is added later, use sheet pattern — do not invent a second visual language.

## Agent Prompt Guide

### Quick color reference

```text
# Light
Primary teal:  #0b6e6e
On-primary:    #f2efe6
Ink:           #14181f
Canvas:        #ffffff
Sidebar:       #fafafa
Hairline:      #e5e5e5

# Dark
Canvas:        #14181f
Sidebar:       #1a1f28
Surface-1:     #1a1f28
Ink:           #f2efe6
Hairline:      #ffffff1a
Active text:   #2dd4bf
Button fill:   #0b6e6e (unchanged)
Code canvas:   #0f1218
```

### Ready-to-use prompts

- “Build this playground page using DESIGN.md: light tokens, teal active states, Geist UI type, hairline demo blocks.”
- “Add sidebar brand lockup: 24px Workbench mark + wordmark; mark fill stays #0b6e6e in dark mode.”
- “Playground ships light-only for now (dark mode deferred — tokens in `.dark` may remain unused). Keep active nav on `--playground-accent`.”
- “Style PlusTable demo chrome quietly; reserve teal for primary actions and validation focus.”
- “Generate favicon.svg from the 2×2 modular mark only (one asset for both themes).”

### Iteration Guide

1. Change one component token at a time (`components.*`).
2. Keep brand chroma singular — teal only (deep fill + bright text in dark).
3. Prefer referencing `{colors.*}` / `{typography.*}` over raw hex in new docs.
4. After token edits, refresh `docs/brand/preview.html` and `preview-dark.html`.
5. Logo geometry changes belong in `docs/brand/` assets + this Brand mark section together.
6. Never update light tokens without the paired dark mapping row.

## Known Gaps

- Element Plus keeps its default theme tokens — do not remap `--el-color-*` to Workbench Teal.
- Sora is required only for brand wordmark fidelity; product UI may stay Geist-only.
- Inline demo code chips use muted surface (not full inverse code-canvas) for readability in docs chrome.
