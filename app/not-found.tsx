import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="error-card">
        <p className="eyebrow">404</p>
        <h1>페이지를 찾을 수 없습니다</h1>
        <p className="muted">
          요청한 경로는 아직 없습니다. 0단계에서는 홈 화면만 준비되어 있습니다.
        </p>
        <div className="error-actions">
          <Link href="/">홈으로 돌아가기</Link>
        </div>
      </div>
    </main>
  );
}
