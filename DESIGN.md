# DESIGN.md — Implementation Guide

> **Current theme: "Studio"** (2026-10-11), taken from `design/workspace-home.html`.
> Cream paper, warm charcoal ink, a dark workspace rail, tangerine brand,
> sage for live / success, soft warm shadows. Same font (Schibsted Grotesk).
> It replaced "Ink & Paper" by changing the tokens in
> `frontend/src/styles/tokens.css`; token NAMES are unchanged, so components
> keep working. Sections below that say "no shadows" or "colour only for
> status" describe the old theme — the token table in section 3 is outdated.
>
> Studio tokens added: `--brand` (headline accent), `--brand-strong` (filled
> tangerine behind white text, AA), `--brand-text` (tangerine text, AA),
> `--brand-soft`, `--badge` / `--badge-ink` (unread counts and dots),
> `--panel` (sidebar), `--rail-bg` / `--rail-ink` / `--rail-muted` /
> `--rail-hover` / `--rail-active` (dark rail), `--butter*`, and real values
> for `--shadow-card` / `--shadow-float`.
> Contrast rule: white text only on `--brand-strong` or `--badge`, never on
> `--brand`; tangerine text uses `--brand-text`.


> **Authoritative design system:** `design/DESIGN.md` — **"Ink & Paper"**.
> Read that first; this file only describes how it is applied in code.

---

## 1. Philosophy (from design/DESIGN.md)

Ink-first, minimal, functional. Black **Ink** drives action and hierarchy;
white **Paper** is the substrate. Depth comes from **tonal layers**, not
shadows. Color is reserved for **status and brand only**. The single brand
color is the green **dot** (`#1E6846`).

## 2. Font

- Single typeface: **Schibsted Grotesk** (Google Fonts), weights 400–700.
- Loaded with `next/font/google` in `frontend/src/app/layout.tsx` as the
  CSS variable `--font-schibsted`.
- High-impact headings use negative tracking (Display/Headline/Title).

## 3. Tokens

All colors/tokens live in `frontend/src/styles/tokens.css` (light + `.dark`).
Components consume variables only — never raw hex.

| Token | Value | Use |
|-------|-------|-----|
| `--paper` | `#ffffff` | page / nested surfaces |
| `--surface` | `#f6f6f4` | cards, wells |
| `--surface-container` / `-high` | `#eeeeee` / `#e8e8e8` | tonal steps |
| `--ink` | `#0c0c0c` | primary text / actions |
| `--ink-secondary` | `#555555` | secondary text |
| `--ink-tertiary` | `#8a8a86` | meta / placeholder |
| `--good` / `--good-tint` | `#1e6846` / `#e7f2ec` | success, "live" chips |
| `--warn` / `--warn-tint` | `#8a6a30` / `#fdf6ec` | warning |
| `--error` / `--error-container` | `#ba1a1a` / `#ffdad6` | errors |
| `--dot` | `#1e6846` | brand dot |
| `--radius` / `--radius-card` / `--radius-lg` | 14 / 18 / 24px | inputs / cards / sections |
| `--radius-pill` | 9999px | buttons, chips |

Semantic aliases (`--text-dark`, `--text-mid`, `--accent`, `--input-bg`,
`--danger`, `--success`, …) map onto the palette so shared components stay
system-agnostic.

## 4. Elevation & shape

- **No shadows / no blurs.** Depth = paper → surface → paper tonal layering.
- No borders on light backgrounds (exception: outlined suggestion chips).
- Buttons and status chips are **pill-shaped**; inputs use 14px radius.

## 5. Components

- **Button** (`components/ui/Button`): ink pill primary, surface pill
  secondary, ghost; min-height 44px.
- **Input** (`components/ui/Input`): 14px radius, `--surface` fill on paper;
  focus = ink border + soft ring; optional `trailing` (e.g. password eye) and
  `labelAction` (e.g. "Forgot password?").
- **Alert** (`components/ui/Alert`): tinted, no border (error / success / info).
- **Chips**: tinted pills (Good/Data/Warn/Alert) with a status dot.

## 6. Auth pages (Phase 1)

Form-left / showcase-right split (reference, not a copy):

- **Left (Paper):** brand mark (ink rounded square + wordmark + green dot) and
  a **live status chip** ("System Operational", wired to API health) on the
  top row; large ink title + subtitle; the form; footer with copyright and
  Privacy / Terms / Security.
- **Right (tonal Surface):** top row with an "Enterprise Ready" chip and a
  trust line; a **floating board mock** (paper card with three tonal columns)
  that gently bobs; a testimonial quote with pager dots.
- Each page owns `page.module.css` setting `--showcase-bg` to a surface tone
  (login / register / forgot / reset) — keeps every page's own style file.
- The showcase hides below 960px; the float respects `prefers-reduced-motion`.

Files:
```
app/(auth)/login/page.tsx + page.module.css
app/(auth)/register/page.tsx + page.module.css
app/(auth)/forgot-password/page.tsx + page.module.css
app/(auth)/reset-password/page.tsx + page.module.css
components/auth/AuthCard.tsx + AuthCard.module.css      (shell + left form panel)
components/auth/AuthShowcase.tsx + AuthShowcase.module.css  (right panel)
components/auth/authForm.module.css                     (shared form primitives)
components/auth/{LoginForm,RegisterForm,ForgotPasswordForm,ResetPasswordForm}.tsx
components/auth/EyeToggle.tsx                           (reusable password eye)
components/ui/{Button,Input,Alert,Spinner}.tsx + *.module.css
```

## 7. Styling conventions

- **Every page has its own `page.module.css`**; reusable components have their
  own `*.module.css`; globals hold only tokens and base body rules.
- Use tokens, not hex. Keep files small and reusable.
- Use the 4px spacing grid; gutters 40px desktop / 20px mobile.

## 8. Accessibility

Visible focus states, labelled fields, `aria-label`s on icon-only controls,
`prefers-reduced-motion` support, and sufficient ink-on-paper contrast.
