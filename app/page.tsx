export default function HomePage() {
  return (
    <main className="panel">
      <p className="eyebrow">CareGap AI · Phase 1</p>
      <h1>돌봄틈새 AI — 인증·사례 API</h1>
      <p className="lede">
        인증 로직과 사례/상담 기록 API가 준비 중입니다. 로그인 UI, AI 분석,
        사업 매칭 화면은 아직 없습니다. Supabase 테스트 프로젝트가 연결되기
        전까지 실제 연동 검사는 차단됩니다.
      </p>
      <ul className="checklist">
        <li>합성 상담 기록만 사용하는 해커톤 MVP 범위</li>
        <li>실제 개인정보·진단·자격 확정·자동 신청 없음</li>
        <li>API: /api/cases 및 상담 기록 생성 엔드포인트</li>
      </ul>
      <div className="status-box">
        <strong>현재 상태:</strong> 1단계 인증·데이터 접근 구현 중. 화면
        흐름(2단계)은 아직 시작하지 않았습니다.
      </div>
    </main>
  );
}
