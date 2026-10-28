# CareGap Progress

**Mode:** sync · 2026-10-28

## Now

로드맵 1단계 엔지니어링 연속: P0 신뢰성 + CI + 평가 시드 + 후속 확인 최소 슬라이스 (`fix/p0-reliability`, 미커밋).

## Done

- P0: Live REST 파싱, 토큰 갱신 동기화, 예약 후 실패·45초, README/ENV/ARCH
- CI workflow (mock E2E placeholder env)
- 평가 fixture 12건 + status agreement 하네스 (의미 평가는 별도)
- 지속 필요(`unchanged`) 매칭 신호
- `follow_up_tasks` SQL/API/UI 대기함

## Next

- 합성 staging에 SQL 004 적용·실 Auth 회귀 (자격정보 필요)
- 평가 세트 전문가 확장 (100~200) · 버전 기록
- 기관 인터뷰(로드맵 #6) · SECURITY 후속(#9)

## Tracks

| Track | Status |
|---|---|
| Replay demo path | Stable (prior RC) |
| Live provider | Mock-only verified |
| Follow-up workflow | Minimal slice |
| Field evidence | Not started |

## Do-not

실데이터·자동 자격·자동 신청·비밀 커밋·추측성 “검증 통과” 보고.
