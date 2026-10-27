# CareGap AI — DESIGN.md (C+B Stage 1 shared system)

## Mode
Operate (caseworker task UI).

## World
Quiet case-file desk: cool wash canvas (`#edf3f4`), teal primary actions (`#125e65`), cool-gray ink, local Pretendard Variable (SIL OFL 1.1 in `app/fonts/FONT-LICENSE.txt`). Refuses metric dashboards, purple AI chrome, cream+terracotta editorial defaults, and decorative glass.

## Surfaces
- `/login` — Stage 2: desktop intro (left) + real credential form (right); mobile logo/short hint → form → long synthetic sample below. No demo credentials or preview button.
- `/cases` — Stage 3: title + local alias search + collapsible create + table (사례명/등록일/상세). id·alias·created_at only; no fake metrics
- `/cases/[id]` — Stage 4: breadcrumb + alias, previous→current compare (text roles), in-page consultation form, 50-cap list/history captions, always-disabled analyze; server summaries only (no replay/program/review injection)

## Tokens
See `app/globals.css` `:root` — C+B raw (`--ink`, `--teal`, `--wash`, …), semantic (`--color-action`, …), and component aliases. Legacy `--pine` / `--paper` names alias to teal/wash so existing class hooks keep working.

## Motion
150ms background/border transitions on controls. Skeleton shimmer for loading only; `prefers-reduced-motion: reduce` disables animation.

## Accessibility
Real labels, `:focus-visible` 3px `#176ea2` outline, `aria-live` on errors, status chips/alerts use text+border+color (not color alone). Touch target goal 44px. Shell checked at 1440 / 1280 / 390 without required page-level horizontal scroll.
