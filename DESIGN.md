# CareGap AI — DESIGN.md (Midnight Transit Evidence Map)

## Mode
Operate (caseworker task UI).

## Locked direction (2026-10-28)
Keep the current navy shell + porcelain card work UI. Do not rebuild cases/detail into a full subway-map information architecture. Transit metaphor stays limited to login personality and light compare accents. Later phases must not redesign these screens unless the user explicitly asks.

## World
Midnight enamel shell (`#0b1c33`) with porcelain work plates (`#fff` / `#f4f7fb`) for readable Korean body copy (≥1.125rem on work panels). Scarlet / cobalt route accents mark **previous** vs **current** evidence only. Amber station ticks for status accents. Hangul-first Pretendard Variable (`--font-ui`). Refuses KPI dashboards, decorative map spaghetti, teal wash desk, Evidence Ledger sapphire chalk, cream+terracotta editorial, side-tab card borders, and heading kickers.

## Split personality (user steer)
- **Login / brand:** Night map personality — dual-station sample linked by one functional route stem.
- **Cases / detail:** Porcelain panels on navy shell for contrast and body size; metaphor limited to compare interchange (inset route bars + optional center connector ≥1280).

## Surfaces
- `/login` — Brand-forward porcelain credential card + night intro with previous/current sample. Mobile: form above intro. Desktop ≥960px: intro left, form right.
- `/cases` — Compact night chrome + porcelain table/create. Local search only. No fake KPIs.
- `/cases/[id]` — Dual-route compare, consultation form, history; analyze stays disabled readiness.

## Tokens
See `app/globals.css` `:root`. Legacy `--pine`/`--teal`/`--wash` alias into cobalt/navy.

## Motion
160ms control transitions; page enter ~280–320ms; skeleton shimmer. `prefers-reduced-motion: reduce` disables.

## Accessibility
Real labels, `:focus-visible` 3px focus ring, `aria-live` errors, status via text+border+color. Body text on porcelain aims ≥4.5:1. Touch ~44px.
