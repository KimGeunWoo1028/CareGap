"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/alert";
import { useAuthSession } from "@/lib/auth/session-context";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/cases";
  return raw;
}

function LoginForm() {
  const { signIn, accessToken, ready } = useAuthSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && accessToken) {
      router.replace(nextPath);
    }
  }, [ready, accessToken, router, nextPath]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn(email.trim(), password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.replace(nextPath);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-frame page-frame--narrow">
      <section className="login-hero">
        <h1>돌봄틈새 AI</h1>
        <p className="lede">
          사전 발급된 테스트 계정으로 로그인하세요. 세션은 이 브라우저 탭
          메모리에만 유지되며, 새로고침 후에는 다시 로그인해야 합니다.
        </p>
      </section>

      <section className="panel">
        <h2 className="panel__title">로그인</h2>
        <p className="panel__desc">
          공개 회원가입과 비밀번호 재설정은 제공하지 않습니다.
        </p>

        <form className="stack" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error ? (
            <Alert tone="error" live>
              {error}
            </Alert>
          ) : null}

          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? "로그인 중…" : "로그인"}
          </button>
        </form>
      </section>

      <Alert tone="warning" title="합성 데이터 안내">
        실제 개인정보·상담 기록·복지 자격 확정·자동 신청은 다루지 않습니다.
      </Alert>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="page-frame page-frame--narrow">
          <p className="muted">로그인 화면을 준비하는 중…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
