# Component Spec — Evidence Ledger (implemented)

## Presentation components

| Component | Path | Responsibility |
|---|---|---|
| `BrandMark` | `components/brand-mark.tsx` | SVG ledger-gap mark |
| `AppHeader` | `components/app-header.tsx` | Brand link, account, logout |
| `StatusBanner` | `components/status-banner.tsx` | Synthetic-data strip on all screens |
| `Alert` | `components/alert.tsx` | error/info/success/warning regions |
| `RequireAuth` | `components/require-auth.tsx` | Gate (behavior unchanged) |
| `SyntheticDataBanner` | `components/synthetic-data-banner.tsx` | Alias of StatusBanner |

## CSS primitives (not separate React files)
- `.btn`, `.field`, `.panel`, `.chip`, `.skeleton`, `.empty`, `table.data`
- Auth: `.auth-shell`, `.auth-form`, `.auth-intro`, `.auth-record`
- Cases: `.cases-page`, `.case-table`, `.cases-search`
- Detail: `.compare-strip`, `.compare-card`, `.note-card`, `.detail-*`

## Rules
- No HTML injection of model output
- Status never color-only
- Focus via `:focus-visible`
- Preserve accessible names used by E2E (labels, button names, headings)
