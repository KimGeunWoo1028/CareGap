"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <main className="error-page">
          <div className="error-card">
            <h1>앱 오류가 발생했습니다</h1>
            <p>
              루트 레이아웃 오류입니다. 다시 시도하거나 개발 서버를 재시작해
              주세요.
            </p>
            {error.digest ? <p>참조 코드: {error.digest}</p> : null}
            <div className="error-actions">
              <button type="button" onClick={reset}>
                다시 시도
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
