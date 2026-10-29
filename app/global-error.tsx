"use client";

/**
 * Root error UI — must not import app CSS modules that could themselves fail.
 * Inline tokens mirror globals.css porcelain/navy system (UX-011).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            '"Pretendard Variable", "Malgun Gothic", sans-serif',
          color: "#f4f7fb",
          background:
            "linear-gradient(180deg, #0b1c33 0%, #071221 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "28rem",
            background: "#ffffff",
            color: "#1c2b40",
            borderRadius: "4px",
            padding: "1.5rem",
            boxShadow: "0 10px 28px rgba(7, 18, 33, 0.28)",
          }}
        >
          <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.35rem" }}>
            앱 오류가 발생했습니다
          </h1>
          <p style={{ margin: "0 0 1rem", lineHeight: 1.6, color: "#4a5d75" }}>
            예기치 않은 오류입니다. 다시 시도하거나 로그인 화면으로 이동해
            주세요. 상담 원문은 서버에 그대로 남아 있을 수 있습니다.
          </p>
          {error.digest ? (
            <p
              style={{
                margin: "0 0 1rem",
                fontSize: "0.875rem",
                color: "#4a5d75",
              }}
            >
              참조 코드: {error.digest}
            </p>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: "44px",
                padding: "0 1rem",
                border: "none",
                borderRadius: "3px",
                background: "#2f6fed",
                color: "#fff",
                font: "inherit",
                cursor: "pointer",
              }}
            >
              다시 시도
            </button>
            <a
              href="/login"
              style={{
                minHeight: "44px",
                padding: "0 1rem",
                display: "inline-flex",
                alignItems: "center",
                borderRadius: "3px",
                border: "1px solid #8fa0b8",
                color: "#1c2b40",
                textDecoration: "none",
                font: "inherit",
              }}
            >
              로그인으로
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
