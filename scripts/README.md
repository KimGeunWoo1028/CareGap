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

The gate may be set in the shell **or** in `.env.local`. Do not commit the gate flag.

Optional password path: set `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD` in `.env.local`. Without them the harness bootstraps user sessions via admin magic-link for JWT/RLS checks only — that path does **not** prove password-login UI success.

## `phase6-replay-rehearsal.mjs`

Password-login A/B checks, Replay create→review×3 on `합성-001`, T06/T17/T18/T22 probes. Requires `ANALYSIS_MODE=replay` and `CARE_GAP_ALLOW_LIVE_INTEGRATION=1`. Does not call OpenAI.

## Real password UI E2E

```bash
$env:CARE_GAP_REAL_AUTH_E2E="1"
npx playwright test e2e/real-auth-flow.spec.ts
```

Requires `TEST_USER_A/B_*` in `.env.local`. Default `npm run test:e2e` skips these tests.

## `phase4-integration.mjs`

Live Supabase checks for Phase 4 analysis create/get/review (replay only).

**Requirements**

- Same gate/keys as Phase 1.
- `ANALYSIS_MODE=replay` (harness refuses live spend).
- Seed alias `합성-001` with the demo consultation pair for the first auth user.
- Dev server at `CARE_GAP_API_BASE` (default `http://127.0.0.1:3000`).

**Run**

```bash
$env:CARE_GAP_ALLOW_LIVE_INTEGRATION="1"
node scripts/phase4-integration.mjs
```
