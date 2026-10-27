export default function HomePage() {
  return (
    <main className="panel">
      <p className="eyebrow">CareGap AI · Phase 0</p>
      <h1>돌봄틈새 AI 프로젝트 골격</h1>
      <p className="lede">
        Next.js App Router와 TypeScript 기반의 최소 실행 환경입니다. 로그인,
        사례 관리, AI 분석, 사업 매칭은 아직 구현되지 않았습니다.
      </p>
      <ul className="checklist">
        <li>합성 상담 기록만 사용하는 해커톤 MVP 범위</li>
        <li>실제 개인정보·진단·자격 확정·자동 신청 없음</li>
        <li>환경 변수는 `.env.example`을 참고해 `.env.local`에만 설정</li>
      </ul>
      <div className="status-box">
        <strong>현재 상태:</strong> 0단계 골격 준비. 다음 단계는 인증과 데이터
        접근(1단계)입니다.
      </div>
    </main>
  );
}
