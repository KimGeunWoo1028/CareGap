# CareGap AI — DESIGN.md (Phase 2 shipped)

## Mode
Operate (caseworker task UI).

## World
Quiet case-file desk: cool mist paper ground, pine primary actions, charcoal ink, single Noto Sans KR family. Refuses metric dashboards, purple AI chrome, cream+terracotta editorial defaults, and decorative glass.

## Surfaces
- `/login` — narrow credential panel, synthetic warning, memory-session notice
- `/cases` — create alias + list table (max 100 notice)
- `/cases/[id]` — readiness chip, latest-two compare strip, note form, immutable note list, analysis history placeholder (no fabricated results)

## Tokens
See `app/globals.css` `:root` (`--pine`, `--paper`, `--ink`, `--warn-*`, `--danger-*`).

## Motion
Minimal: skeleton shimmer for loading only. No page-load choreography.

## Accessibility
Real labels, visible focus, `aria-live` on errors, status chips use text+color, 1280/390 layouts without required horizontal page scroll.
