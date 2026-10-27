# CareGap verification scripts

## `phase1-integration.mjs`

Live Supabase checks for Phase 1 auth/RLS/API contracts.

**Requirements**

- Local `.env.local` with CareGap **test** project keys (never commit).
- `CARE_GAP_ALLOW_LIVE_INTEGRATION=1` in the shell environment.
- Dev or production server reachable at `CARE_GAP_API_BASE` (default `http://127.0.0.1:3000`).

**Safety**

- Does not print passwords, JWTs, or secret keys.
- Refuses non-`*.supabase.co` hosts.
- Does not delete or rewrite seed alias `합성-001`.
- May create temporary `합성-NNN` cases and consultations for isolation tests.

**Run**

```bash
# PowerShell
$env:CARE_GAP_ALLOW_LIVE_INTEGRATION="1"
node scripts/phase1-integration.mjs
```

Optional password path: set `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD` in `.env.local`. Without them the harness bootstraps user sessions via admin magic-link for JWT/RLS checks only — that path does **not** prove password-login UI success.
