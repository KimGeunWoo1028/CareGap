# CareGap AI — product truth

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: welfare caseworkers reviewing synthetic demo cases during a hackathon demo.
Secondary: presenters who must show live vs replay analysis modes honestly.

## Product Purpose
A hackathon MVP web app that helps caseworkers compare two synthetic consultation notes and review AI-suggested change evidence. Success means the worker can read previous/current notes, see readiness for comparison, and never confuse the tool with diagnosis, risk scoring, eligibility confirmation, or application submission.

## Positioning
Compares the latest two consultation notes with exact-quote evidence discipline; program candidates (when later enabled) come from server rules, not the model inventing benefits.

## Core jobs (Phase 2 scope)
1. Sign in with a pre-provisioned test account (memory session only).
2. Create/list own synthetic cases (`합성-NNN`).
3. Add immutable consultation notes and see the latest two comparison candidates.

## Non-goals
Real personal data, public signup, password reset, note edit/delete, fake analysis results, automated applications.

## Constraints
Korean UI, API snake_case contracts from API_SPEC, synthetic-only banner on every screen, 1280px / 390px usable, keyboard accessible.

## Brand commitments
Product name 돌봄틈새 AI / CareGap AI. Visual world: Midnight Transit Evidence Map (Impeccable challenger `wayfinding-cartography-signage-midnight-transit-diagram`, seed `3ded0ac4`) with user steer — login may be expressive; case/detail prioritize Hangul readability; route metaphor only for previous↔current evidence connection; no decorative analytics graphs. Not an AI metric dashboard.
