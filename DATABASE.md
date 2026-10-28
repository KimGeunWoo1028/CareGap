# 데이터베이스 — Supabase Postgres

## 적용 순서

1. 합성 데이터 전용 테스트 프로젝트를 만든다. Supabase Auth에서 공개 가입을 끄고 팀용 테스트 계정 A·B를 각각 만든다. 테스트 비밀번호와 키는 문서·저장소에 넣지 않는다.
2. SQL Editor에서 [sql/001_schema.sql](sql/001_schema.sql) 전체를 **새 프로젝트에 한 번만** 실행한다. 이 파일은 재실행용 마이그레이션이 아니다. 운영 중 DB에 무심코 실행하지 않는다.
3. [sql/002_programs.sql](sql/002_programs.sql)을 실행한다. 사업 시드는 ID 기준 갱신 가능하다. [sql/003_demo_seed.sql](sql/003_demo_seed.sql)에서 이메일을 A의 테스트 이메일로 바꾸고 실행한다. B에도 자료가 필요하면 별도 이메일로 반복한다.
4. 후속 확인: [sql/004_follow_up_tasks.sql](sql/004_follow_up_tasks.sql) → [sql/004a_follow_up_terminal_immutable.sql](sql/004a_follow_up_terminal_immutable.sql) 순으로 적용한다(불변 스냅샷, CareGap Test에 재적용하지 않음). 검토·후속 원자성 트리거 [sql/005_review_follow_up_atomicity.sql](sql/005_review_follow_up_atomicity.sql)은 **별도 승인 후** 1회 적용.
5. 각 로그인 토큰으로 API와 Supabase 직접 호출을 시험한다. A의 사례를 B가 읽을 수 없고 분석 행 직접 쓰기가 거부되는지 [TEST_PLAN.md](TEST_PLAN.md)대로 확인한다. 스키마 적용이나 공급자 권한은 실제 프로젝트마다 확인해야 한다.
6. `needs_followup` 검토 저장 시 후속 업무는 005 트리거가 **같은 트랜잭션**에서 만든다. 005 이전 고아 검토는 `POST /follow-ups` 또는 `createFollowUpFromReview`로 수동 복구한다.

## 엔터티

| 테이블 | 필드·관계 | 작성 주체 |
|---|---|---|
| `cases` | `id`, `owner_id`(Auth 사용자), `alias`, `created_at`; 사용자별 별칭 유일 | 인증 사용자, 자신의 owner_id만 |
| `consultations` | `id`, `case_id`, `occurred_on`, `channel`, `body`, `created_at`; 사례+날짜 유일 | 인증 사용자, 소유 사례만 |
| `welfare_programs` | 텍스트 ID, `name`, `tags`, `summary`, `eligibility_checks`, `region`, `source_url`, `source_checked_on`, `catalog_version`, `active` | 관리자 시드만, 인증 사용자 읽기 |
| `analyses` | `id`, `case_id`, `owner_id`, 두 기록 ID, `idempotency_key`, `mode`, `status`, `schema_version`, `model`, `result`, `failure_code`, 시각 | 예약 함수 + 서버 서비스 키, 사용자는 자신의 행 조회만 |
| `reviews` | `id`, `analysis_id`(유일), `owner_id`, `decision`, `note`, `created_at` | 인증 사용자, 자신의 성공 분석만 |
| `follow_up_tasks` | `id`, `owner_id`, `case_id`, `analysis_id?`, `kind`, `status`, `due_on?`, `note`, 시각; open+(analysis_id,kind) 유일 | 인증 사용자(본인 사례·본인 분석). 사람이 완료/취소. **004는 CareGap Test 승인 후 1회 적용** |

UUID/날짜/채널과 상태 값은 API_SPEC을 따른다. 기록은 불변이며 결과의 인용은 저장된 원문의 부분 문자열이다. JSONB는 `{"analysis": <AI_SPEC의 객체>, "recommendations": [...]}`를 포함한다. JSON 내부 스키마·인용 및 사업 매칭은 서버가 검증한다. DB 자체가 JSON 의미까지 확인해 주지는 않는다.

## RLS 및 원자성

- 사용자 정책은 `auth.uid()`를 기반으로 한다. 사례·기록은 소유자만 읽고 생성한다. 분석은 자신만 읽을 수 있으나 직접 생성·수정·삭제할 수 없다. 검토는 자신의 성공 결과에 대해서만 1회 생성할 수 있다. update/delete 정책과 권한은 없다.
- `start_analysis`는 SECURITY DEFINER 함수로 오직 인증 역할만 실행할 수 있고, `auth.uid()`와 소유 사례를 직접 확인한다. 검색 경로를 고정한다. 사용자별 advisory 잠금으로 동시 예약과 live 횟수 제한을 직렬화한다. 같은 키/다른 사례 또는 모드 충돌, 사례당 처리 중 결과 1개, 오래된 작업 정리가 원자적이다. 정리 뒤 충돌·부족·한도 초과는 예외가 아닌 JSON `error_code`를 반환해 정리를 롤백하지 않는다. 최신 두 기록은 한 SQL 조회에서 선택한다.
- 사용자 역할에서 직접 `start_analysis` RPC를 호출하는 것은 가능하나 완료할 권한은 없다. 악의적 합성 계정의 예약 남용은 완전 차단하지 못한다. 대회에선 비공개 테스트 계정만 사용한다. 공개 서비스 전 별도 유량 제한이 필요하다.
- 서버의 서비스 키는 RLS를 우회한다. 최종 업데이트 전에 토큰 검증 및 사용자 권한으로 읽은 `analysis_id`, `owner_id`, `case_id`를 모두 조건에 포함하고, `status='processing'`인 행만 갱신한다. 반환 행이 0개면 이미 만료/완료된 것으로 간주하고 결과를 버린다. 예: `UPDATE analyses SET status='succeeded', result=:validated, model=:model, completed_at=now() WHERE id=:id AND owner_id=:actor AND case_id=:case AND status='processing' RETURNING id`. 실패도 동일 조건으로 `status='failed'`, `failure_code`, `completed_at`만 설정한다.
- 주의: 관리자/서비스 키는 DB 제약 이외의 RLS를 우회한다. `analyses.owner_id`와 case 소유자가 같은지는 예약 함수가 보장하며 서비스 키로 직접 INSERT하지 않는다. 인증된 사용자의 직접 INSERT는 RLS를 우회하지 않지만 서버의 합성 탐지·정규화 검증은 우회할 수 있으므로 프로젝트를 비공개로 제한한다.

## 결과 수명과 최신 여부

실패도 분석 행 하나로 저장하며 `result=null`, `failure_code`가 채워진다. 같은 키는 초기 상태를 재사용하고 성공/실패 여부를 다시 돌려준다. 새로운 상담이 추가되면 새 키로 다시 분석해야 한다. `is_current`는 저장 열이 아니라 서버가 현재 최신 두 기록 ID와 분석 두 기록 ID를 비교해 계산한다. 실패/처리 중에도 입력 ID는 보존한다.

## 검증 한계

SQL은 Supabase 기본 `auth.users`, `auth.uid()`, `anon`, `authenticated`, `service_role`이 있는 새 프로젝트를 전제로 한다. 제공된 SQL은 문서 작성 시 실제 Supabase 프로젝트에서 적용되거나 RLS 보안 점검이 완료된 것이 아니다. 적용과 2계정 권한 시험을 반드시 수행한다. 백업, 복구, 보존·파기, 복수 기관·담당자 할당, 접근 감사는 기관 도입 단계의 별도 설계다.
