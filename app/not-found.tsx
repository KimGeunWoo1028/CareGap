import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="error-card">
        <h1>페이지를 찾을 수 없습니다</h1>
        <p className="muted">
          요청한 경로가 없거나 접근할 수 없습니다. 합성 데이터 전용 MVP입니다.
        </p>
        <div className="error-actions">
          <Link className="btn btn--primary" href="/login">
            로그인으로
          </Link>
        </div>
      </div>
    </main>
  );
}
