"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="error-page">
      <div className="error-card">
        <h1>화면을 표시하지 못했습니다</h1>
        <p className="muted">
          잠시 후 다시 시도해 주세요. 합성 데모 환경이며 실제 상담 데이터는
          처리하지 않습니다.
        </p>
        {error.digest ? (
          <p className="muted">참조 코드: {error.digest}</p>
        ) : null}
        <div className="error-actions">
          <button type="button" className="btn btn--primary" onClick={reset}>
            다시 시도
          </button>
          <Link className="btn btn--ghost" href="/login">
            로그인으로
          </Link>
        </div>
      </div>
    </main>
  );
}
