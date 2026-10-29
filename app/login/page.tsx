"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import { BrandMark } from "@/components/brand-mark";
import { useAuthSession } from "@/lib/auth/session-context";
import { readQueryParam } from "@/lib/url-state";

/** Fixed synthetic illustration for the login intro only — not live case data. */
const SAMPLE_PREVIOUS =
  "혼자 식사도 잘하시고 가까운 가게까지 걸어가 장을 볼 수 있음.";
const SAMPLE_CURRENT =
  "최근 다리가 불편해 장을 보기 어렵고 식사를 자주 거르심.";
const SAMPLE_PREVIOUS_QUOTE = "식사도 잘하시고";
const SAMPLE_CURRENT_QUOTE = "식사를 자주 거르심.";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/cases";
  return raw;
}

function HighlightedQuote({
  text,
  quote,
}: {
  text: string;
  quote: string;
}): ReactNode {
  const index = text.indexOf(quote);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{quote}</mark>
      {text.slice(index + quote.length)}
    </>
  );
}

function LoginIntro() {
  return (
    <aside className="auth-intro map-corridor" aria-labelledby="auth-intro-title">
      <div className="map-corridor__head">
        <h2 id="auth-intro-title" className="auth-intro__title">
          두 기록이 만나는 지점,
          <br />
          <span>판단을 돕는 근거.</span>
        </h2>
        <p className="auth-intro__lede">
          이전·현재 상담을 나란히 두고, 변화가 나타난 원문 근거를 연결해 읽도록
          돕는 담당자 보조 도구입니다. AI가 자격이나 진단을 확정하지 않습니다.
        </p>
      </div>

      <div className="interchange-demo" aria-label="합성 원문 예시">
        <div className="interchange-demo__rail" aria-hidden="true">
          <span className="interchange-demo__hub" />
        </div>
        <div className="auth-pair interchange-demo__platforms">
          <article className="auth-record station-card station-card--previous">
            <header>
              <strong>이전 상담</strong>
              <time dateTime="2026-09-10">2026.09.10</time>
            </header>
            <blockquote>
              <HighlightedQuote
                text={SAMPLE_PREVIOUS}
                quote={SAMPLE_PREVIOUS_QUOTE}
              />
            </blockquote>
          </article>
          <article className="auth-record station-card station-card--current">
            <header>
              <strong>현재 상담</strong>
              <time dateTime="2026-10-10">2026.10.10</time>
            </header>
            <blockquote>
              <HighlightedQuote
                text={SAMPLE_CURRENT}
                quote={SAMPLE_CURRENT_QUOTE}
              />
            </blockquote>
          </article>
        </div>
      </div>

      <p className="auth-caption">
        강조된 문장은 식사 변화의 근거 예시입니다. 노선 연결은 설명용 은유이며
        분석 결과를 만들지 않습니다.
        <br />
        합성 원문 예시 · 실제 분석이 실행된 결과가 아니며, 담당자 사례를 불러온
        것도 아닙니다.
      </p>
      <p className="auth-caption auth-caption--session">
        세션은 이 브라우저 탭 메모리에만 유지되며, 새로고침 후에는 다시
        로그인해야 합니다. 공개 회원가입과 비밀번호 재설정은 제공하지 않습니다.
      </p>
    </aside>
  );
}

function LoginForm() {
  const { signIn, accessToken, ready } = useAuthSession();
  const router = useRouter();
  /** Avoid useSearchParams Suspense hangs on some Turbopack/dev clients (UX-010). */
  const [nextPath] = useState(() =>
    typeof window !== "undefined"
      ? safeNextPath(readQueryParam("next"))
      : "/cases",
  );
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
    <main className="auth-shell auth-map">
      <div className="auth-map__backdrop" aria-hidden="true">
        <svg className="auth-map__svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <path
            d="M80 220 H420 L560 400 H1120"
            stroke="#e23b2f"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            opacity="0.18"
          />
          <path
            d="M80 580 H420 L560 400 H1120"
            stroke="#2f6fed"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            opacity="0.2"
          />
          <circle cx="560" cy="400" r="18" fill="#071221" stroke="#f4f7fb" strokeWidth="3" opacity="0.35" />
          <circle cx="560" cy="400" r="6" fill="#f0a202" opacity="0.4" />
        </svg>
      </div>

      <section className="panel auth-form map-platform" aria-labelledby="login-heading">
        <div className="map-platform__ticket">
          <span className="map-platform__code" aria-hidden="true">
            GATE
          </span>
          <div className="auth-brand">
            <div className="auth-brand__row">
              <BrandMark className="auth-brand__mark" size={34} />
              <h1 id="login-heading" className="auth-brand__title">
                돌봄틈새 AI
              </h1>
            </div>
            <p className="auth-brand__hint">
              사전 발급된 테스트 계정으로 로그인하세요.
            </p>
          </div>
        </div>

        <form className="stack auth-form__fields" onSubmit={onSubmit} noValidate method="post">
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
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
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
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>

          {error ? (
            <div id="login-error">
              <Alert tone="error" live>
                {error}
              </Alert>
            </div>
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

        <p className="auth-form__fine">
          상단의 합성 데이터 전용 · 담당자 판단 보조 안내가 모든 화면에
          유지됩니다. 세션·가입 정책은 옆(모바일에서는 아래) 소개에서 확인할 수
          있습니다.
        </p>
      </section>

      <LoginIntro />
    </main>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
