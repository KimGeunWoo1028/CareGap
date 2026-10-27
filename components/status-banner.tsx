export function StatusBanner() {
  return (
    <aside className="status-banner" role="status">
      <span className="status-banner__mark" aria-hidden="true" />
      <p>
        <strong>합성 데이터 전용</strong>
        <span aria-hidden="true"> · </span>
        담당자 판단 보조
      </p>
    </aside>
  );
}
