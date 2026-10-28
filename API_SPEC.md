# API 계약 v1

모든 앱 API는 `/api` 아래 Next.js Node.js Route Handler다. 응답·요청 JSON은 UTF-8, snake_case. 모든 경로에서 사용자 토큰 `Authorization: Bearer <access_token>`을 Supabase Auth `getUser(token)`으로 검증한다. 세션 발급·갱신은 브라우저에서 Supabase Auth SDK를 직접 사용한다. API 호출은 HTTPS 또는 localhost, 캐시 금지 `Cache-Control: no-store`. 인증하지 못하면 401, 다른 사용자의 리소스는 존재 여부를 감춰 404. 서버는 요청에서 owner ID를 받지 않는다.

## 공통 응답

성공: `{ "data": <객체 또는 배열>, "meta": {"request_id":"<uuid>"} }`. 컬렉션에 별도 pagination 없음: `GET /cases`는 최대 100건, 각 사례의 기록과 분석은 최신 50건까지. 한도 초과 UI는 MVP에서 최신 항목만 보임을 표시한다. 사례의 전체 기록에서 최신 두 건 선택은 이 응답 한도와 무관하게 DB에서 직접 한다.

오류: `{ "error": {"code":"...","message":"사용자에게 표시할 한국어 안내","request_id":"<uuid>","details":{} } }`. `details`는 아래 정해진 경우만 포함하고 빈 객체가 기본이다. 민감 내용·원문·공급자 내부 메시지를 반환하지 않는다.

| HTTP | code | 조건 / 다음 행동 |
|---|---|---|
| 400 | VALIDATION_ERROR | 잘못된 JSON, 누락/잘못된 값, 추가 속성, 의심 식별정보 → 입력 확인 |
| 401 | UNAUTHENTICATED | 토큰 없음/만료 → 재로그인 |
| 404 | NOT_FOUND | 사례·분석 없음 또는 접근 불가 |
| 409 | DUPLICATE_ALIAS / DUPLICATE_DATE / REVIEW_EXISTS | 사례 별칭, 날짜, 검토 중복 |
| 409 | IDEMPOTENCY_CONFLICT | 같은 키로 다른 사례 또는 다른 모드 요청 |
| 409 | ANALYSIS_IN_PROGRESS | 해당 사례에서 다른 키로 분석 진행 중 |
| 409 | ANALYSIS_FAILED | 같은 키가 이미 실패로 끝남; details에 `analysis_id`, `failure_code` |
| 422 | NOT_ENOUGH_RECORDS | 다른 날짜 기록 2건 미만 |
| 422 | REPLAY_UNAVAILABLE | replay의 입력이 고정 예시와 다름; details에 `analysis_id` |
| 429 | RATE_LIMITED | live 요청의 분당/24시간 한도 초과, `Retry-After: 60`은 최소 안내이지 24시간 한도 보장 해제 시각이 아님 |
| 502 | AI_UNAVAILABLE / INVALID_AI_OUTPUT | 공급자 호출 실패 또는 구조·인용 검증 실패; details에 `analysis_id` |
| 504 | TIMEOUT | 분석 실행 제한 초과; details에 `analysis_id` |
| 503 | SERVICE_UNAVAILABLE | DB/설정 장애, 추후 재시도; 예약 후 장애면 details에 `analysis_id` 가능 |

예약한 뒤 실패하면 먼저 해당 analysis를 실패로 조건부 저장하고 에러를 응답한다. DB 장애로 갱신이 불가하면 503과 analysis_id를 주고 60초 후 새 요청에서 정리한다. UI는 자동으로 replay 전환하지 않는다. 아래 JSON의 UUID·시각은 예시다.

## 사례와 기록

### `GET /cases` → 200

```json
{"data":[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","alias":"합성-001","created_at":"2026-10-10T01:00:00Z"}],"meta":{"request_id":"d1111111-1111-4111-8111-111111111111"}}
```

최신 생성 순. 입력 없음. 정렬 타이브레이커 id 내림차순.

### `POST /cases` → 201

```json
{"alias":"합성-001"}
```

응답 data는 위 사례 객체. alias는 `^합성-[0-9]{3}$`; 추가 필드 금지. 본인 내 중복은 409.

### `GET /cases/{case_id}` → 200

`data`는 아래 구조. `consultations`는 occurred_on 내림차순 최대 50건, `analyses`는 created_at/id 내림차순 최대 50건의 요약이며 초기에는 빈 배열이다. `latest_analysis`의 별도 필드는 없다.

```json
{"data":{"case":{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","alias":"합성-001","created_at":"2026-10-10T01:00:00Z"},"consultations":[{"id":"22222222-2222-4222-8222-222222222222","case_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","occurred_on":"2026-10-10","channel":"phone","body":"최근 다리가 불편해 장을 보기 어렵고 식사를 자주 거르심.","created_at":"2026-10-10T01:01:00Z"},{"id":"11111111-1111-4111-8111-111111111111","case_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","occurred_on":"2026-09-10","channel":"phone","body":"혼자 식사도 잘하시고 가까운 가게까지 걸어가 장을 볼 수 있음.","created_at":"2026-09-10T01:01:00Z"}],"analyses":[]},"meta":{"request_id":"d1111111-1111-4111-8111-111111111111"}}
```

각 분석 요약은 `{id,case_id,status,mode,created_at,completed_at,is_current}`. `is_current`는 이 사례의 최신 두 기록 ID와 해당 분석의 기록 ID를 대조한 불리언이며 기록이 2개 미만이면 false. 처리 중·실패도 동일하게 계산한다.

### `POST /cases/{case_id}/consultations` → 201

```json
{"occurred_on":"2026-10-10","channel":"phone","body":"최근 다리가 불편해 장을 보기 어렵고 식사를 자주 거르심."}
```

응답 data는 위의 상담 객체 형태다. `occurred_on`은 유효한 ISO 날짜로 서울 날짜 기준 미래가 아니어야 한다. `channel`은 phone/visit/other. `body`는 공백만 아닌 코드포인트 1~2,000자; 유니코드 입력 원문 보존. 이메일·전화·주민등록번호 패턴처럼 직접 식별정보 의심은 400. 정규식 차단은 완전한 개인정보 탐지가 아니다. 서버는 body와 review note에 다음 JavaScript 정규식을 각각 적용한다: 이메일 `/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i`, 국내 휴대전화 `/(?:^|[^0-9])01[016789][- ]?[0-9]{3,4}[- ]?[0-9]{4}(?:$|[^0-9])/`, 주민등록번호 형태 `/(?:^|[^0-9])[0-9]{6}[- ]?[1-4][0-9]{6}(?:$|[^0-9])/`. 하나라도 일치하면 400. 이 규칙은 오탐·누락 가능하며 실제 개인정보 반입을 허용하는 근거가 아니다. 동일 사례 날짜 중복 409. 추가 필드 불허. 수정/삭제 API는 없다.

## 분석

### `POST /cases/{case_id}/analyses` → 201 / 200 / 202

헤더 `Idempotency-Key: <UUID>` 필수. 요청 본문은 빈 객체 `{}`. 모드는 서버 설정을 따른다. 동일 사용자·동일 키·동일 case와 mode는 과거 요청을 재사용하고 새 AI 호출을 하지 않는다. 다르면 409. 새 상담이 들어와도 같은 키의 분석은 원래 입력에 고정된다. 새로운 분석은 새 키를 쓴다.

- 새 작업이 동기 완료되면 201, 기존 성공 반복은 200, 동일 키 진행 중이면 202. `data`는 `GET /analyses/{id}`와 같은 analysis 객체다.
- 새 작업 처리 도중 사용자가 연결을 잃으면 같은 키로 재요청하거나 ID를 알고 있으면 GET한다. 다른 키의 동시 요청은 409. 클라이언트 타임아웃 후 재요청에서 202면 3초 간격으로 GET, 60초 이후 새 키 재요청을 안내한다.
- live 한도/오류는 공통 표 참조. replay 입력 불일치는 422이며 예약된 행이 failed로 남는다. 실패 재시도는 반드시 새 키를 사용한다.

### `GET /analyses/{analysis_id}` → 200

`data`에는 `id`, `case_id`, `previous_note_id`, `current_note_id`, `status`, `mode`, `schema_version`, `model`(live 모델명 또는 null), `result`(성공에서만 객체), `failure_code`(실패에서만 문자열), `created_at`, `completed_at`(처리 중 null), `is_current`, `review`(없으면 null)가 항상 있다. 이전/현재 상담 날짜와 본문은 사례 상세에서 읽는다. `processing`이나 `failed`에서는 `result=null`; 실패 오류 원문은 저장하지 않는다.

성공 응답 전체는 [success-response.json](fixtures/success-response.json)을 참조한다. 아래는 `data.result`의 완전한 예시이며 네 범주 모두 포함한다:

```json
{"analysis":{"schema_version":"1.0","summary":"최근 기록에서 식사 유지와 장보기에 어려움이 나타나 추가 확인이 필요합니다.","changes":[{"domain":"meal","status":"worsened","explanation":"이전에는 식사를 잘했으나 최근 자주 거른다는 기록이 있습니다.","evidence_previous":{"note_id":"11111111-1111-4111-8111-111111111111","quote":"혼자 식사도 잘하시고"},"evidence_current":{"note_id":"22222222-2222-4222-8222-222222222222","quote":"식사를 자주 거르심."}},{"domain":"mobility","status":"worsened","explanation":"이전에는 걸어서 장을 볼 수 있었으나 최근 다리 불편으로 장보기가 어렵다고 기록되었습니다.","evidence_previous":{"note_id":"11111111-1111-4111-8111-111111111111","quote":"가까운 가게까지 걸어가 장을 볼 수 있음."},"evidence_current":{"note_id":"22222222-2222-4222-8222-222222222222","quote":"다리가 불편해 장을 보기 어렵고"}},{"domain":"health","status":"unknown","explanation":"건강 상태의 변화를 비교할 정보가 충분하지 않습니다.","evidence_previous":null,"evidence_current":null},{"domain":"environment","status":"unknown","explanation":"생활환경의 변화를 비교할 정보가 충분하지 않습니다.","evidence_previous":null,"evidence_current":null}],"questions":["최근 식사를 거르는 빈도와 이유는 무엇인가요?","다리 불편이 언제 시작되었고 외출에 어떤 영향을 주나요?"]},"recommendations":[{"program_id":"daegu_integrated","name":"대구형 통합돌봄 단디돌봄","matched_domains":["meal","mobility"],"summary":"대구 지역의 의료·요양·돌봄 연계 상담 후보","eligibility_status":"unverified","eligibility_checks":["대구 거주 및 돌봄 필요 여부","주소지 구·군별 제공 서비스와 비용","신청 후 조사 및 기존 서비스 이용 상황"],"region":"daegu","source_url":"https://info.daegu.go.kr/newshome/mtnmain.php?mtnkey=articleview&mkey=scatelist&mkey2=1&aid=276466","source_checked_on":"2026-10-27","catalog_version":"2026-10-27"},{"program_id":"senior_care","name":"노인맞춤돌봄서비스","matched_domains":["meal","mobility"],"summary":"생활 유지에 도움이 필요한 노인을 위한 안전·일상생활 지원 등의 사업","eligibility_status":"unverified","eligibility_checks":["만 65세 이상 여부와 관련 수급 자격","돌봄 필요도와 선정 조사","유사 서비스 중복 이용 여부와 지역 수행기관"],"region":"national","source_url":"https://www.mohw.go.kr/menu.es?mid=a10712010400","source_checked_on":"2026-10-27","catalog_version":"2026-10-27"}]}
```

### `POST /analyses/{analysis_id}/reviews` → 201

```json
{"decision":"needs_followup","note":"식사 빈도와 이동 상황을 추가 확인할 예정"}
```

`decision`은 confirmed/needs_followup/rejected. `note`는 필수 문자열이며 최대 500자, rejected는 공백 아닌 사유 필수, 나머지는 빈 문자열 허용. 직접 식별정보 의심 시 400. 성공 분석에 대해서만 한 번 작성; 이미 작성 시 409 REVIEW_EXISTS. 실패/진행 분석은 409 `ANALYSIS_IN_PROGRESS`(처리 중) 또는 `ANALYSIS_FAILED`(실패)로 거부. 응답 data는 `{id,analysis_id,decision,note,created_at}`. 검토 내용은 연계 완료나 지원 결정의 증거가 아니다. `needs_followup`일 때 `follow_up_tasks` `next_consultation`은 DB 트리거(`sql/005`; CareGap Test는 `005b`로 교정된 동일 본문)가 **검토 INSERT와 동일 트랜잭션**에서 만든다. 트리거 실패 시 검토도 롤백된다. `confirmed`/`rejected`는 자동 후속을 만들지 않는다.

### `GET /follow-ups` → 200

선택 쿼리 `status=open|done|cancelled`. 응답 data는 본인 소유 후속 확인 배열. 각 항목: `id`, `owner_id`, `case_id`, `analysis_id`, `kind`(`next_consultation`|`eligibility_check`|`referral_outcome`), `status`, `due_on`, `note`, `created_at`, `completed_at`. 자격·연계 완료의 자동 증거가 아니다.

### `POST /follow-ups` → 201

```json
{"case_id":"…","analysis_id":null,"kind":"eligibility_check","note":"소득·거주 확인","due_on":"2026-11-05"}
```

본인 사례만. `kind`·`note`(≤500)·선택 `due_on`(YYYY-MM-DD)·선택 `analysis_id`. 같은 `analysis_id`+`kind`에 열린 행이 있으면 400 `VALIDATION_ERROR`(`follow_up_open_exists`). `analysis_id`가 있으면 해당 분석이 본인 소유이며 `case_id`와 일치해야 한다(RLS insert 정책).

### `PATCH /follow-ups/{task_id}` → 200

```json
{"status":"done"}
```

`status`는 `done` 또는 `cancelled`만. 열린(`open`) 본인 행만 종결한다. 이미 종결·타인이면 404.

## 공급자 및 구현 주의

SQL 예약 함수의 JSON `error_code` 또는 `P0001` 메시지는 화이트리스트만 위 표의 코드/HTTP로 바꾼다. 오래된 작업 정리 후 발생하는 충돌·제한은 예외 대신 JSON 오류를 반환해 정리 트랜잭션을 커밋한다. PostgreSQL 23505는 제약명을 기준으로 별칭/날짜/검토/처리 중 충돌로 변환한다. 알 수 없는 예외는 503, 원문과 키는 로깅 금지. 분석 실패를 성공 응답에 빈 결과로 숨기지 않는다. 요청 크기는 16 KiB 초과 시 400 VALIDATION_ERROR, 원본 문자열 길이는 유니코드 코드포인트로 센다.
