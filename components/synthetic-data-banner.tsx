export function SyntheticDataBanner() {
  return (
    <aside className="synthetic-banner" role="status" aria-live="polite">
      <p>
        <strong>합성 데이터 전용</strong>
        {" — "}
        실제 개인정보·상담 기록·복지 자격 확정·자동 신청은 다루지 않습니다.
        해커톤 MVP 골격 단계이며 앱 기능은 아직 구현되지 않았습니다.
      </p>
    </aside>
  );
}
