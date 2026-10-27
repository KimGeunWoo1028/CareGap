# Cursor 시작 프롬프트

프로젝트 폴더로 패키지를 열고 Cursor Agent에서 아래를 입력한다. Cursor는 프로젝트의 `AGENTS.md`를 읽을 수 있다. 참조가 누락되지 않게 `@AGENTS.md`, `@INDEX.md`, 이번 단계 문서를 직접 붙인다. 다음에 [IMPLEMENTATION_PHASES.md](IMPLEMENTATION_PHASES.md)의 선택한 단계 전문을 붙인다.

```text
@AGENTS.md @INDEX.md @SRS.md @API_SPEC.md @AI_SPEC.md
돌봄틈새 AI의 해커톤 MVP를 이 문서대로 구현합니다. 이 저장소의 기존 파일을 먼저 살피고, P0만 구현하며, 실제 데이터나 자동 판정·신청 기능은 넣지 마세요. SQL/RLS, API 필드, AI 근거 검증, replay 표기를 변경하지 말고 해당 단계의 완료 조건과 테스트를 확인하세요. 수정 파일과 검사 결과, 수행하지 못한 일 및 이유를 보고하세요. 지금은 이어지는 단계 하나만 진행합니다.
```

동시 협업 시 역할 소유 파일을 명시한다. Cursor가 파일을 읽지 못하거나 문서가 문맥에 들어가지 않으면 관련 내용을 직접 첨부한다.
