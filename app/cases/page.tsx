"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import {
  apiRequest,
  userMessageForApiError,
  type ApiFailure,
} from "@/lib/api/client";
import { useAuthSession } from "@/lib/auth/session-context";
import { formatSeoulDateTime } from "@/lib/format";
import type { CaseRecord } from "@/lib/cases/types";

const ALIAS_PATTERN = /^합성-[0-9]{3}$/;

function CasesPageInner() {
  const { accessToken, clearSession, signOut } = useAuthSession();
  const router = useRouter();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAuthFailure = useCallback(
    async (failure: ApiFailure) => {
      if (failure.status === 401 || failure.code === "UNAUTHENTICATED") {
        clearSession();
        await signOut();
        router.replace("/login");
      }
    },
    [clearSession, signOut, router],
  );

  const loadCases = useCallback(async () => {
    setError(null);
    setLoading(true);
    const result = await apiRequest<CaseRecord[]>("/api/cases", {
      token: accessToken,
    });
    if (!result.ok) {
      setCases([]);
      setError(userMessageForApiError(result));
      await handleAuthFailure(result);
      setLoading(false);
      return;
    }
    setCases(result.data ?? []);
    setLoading(false);
  }, [accessToken, handleAuthFailure]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiRequest<CaseRecord[]>("/api/cases", {
        token: accessToken,
      });
      if (cancelled) return;
      if (!result.ok) {
        setCases([]);
        setError(userMessageForApiError(result));
        setLoading(false);
        await handleAuthFailure(result);
        return;
      }
      setCases(result.data ?? []);
      setError(null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, handleAuthFailure]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const trimmed = alias.trim();
    if (!ALIAS_PATTERN.test(trimmed)) {
      setFormError("별칭은 합성-001 형식으로 입력해 주세요.");
      return;
    }
    setCreating(true);
    const result = await apiRequest<CaseRecord>("/api/cases", {
      method: "POST",
      token: accessToken,
      body: { alias: trimmed },
    });
    setCreating(false);
    if (!result.ok) {
      setFormError(userMessageForApiError(result));
      await handleAuthFailure(result);
      return;
    }
    setAlias("");
    router.push(`/cases/${result.data.id}`);
  }

  return (
    <main className="page-frame">
      <AppHeader onSignOut={() => router.replace("/login")} />

      <section className="panel">
        <h1 className="panel__title">내 합성 사례</h1>
        <p className="panel__desc">
          본인 소유 사례만 표시됩니다. 목록은 최신 생성 순으로 최대 100건이며,
          초과분은 보이지 않을 수 있습니다.
        </p>

        <form className="stack" onSubmit={onCreate} style={{ marginTop: "1rem" }}>
          <div className="field">
            <label htmlFor="alias">새 사례 별칭</label>
            <input
              id="alias"
              name="alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="합성-001"
              autoComplete="off"
              disabled={creating}
              aria-describedby="alias-hint"
            />
            <p id="alias-hint" className="field__hint">
              합성-001 형식 · 동일 별칭 중복 불가
            </p>
          </div>
          {formError ? (
            <Alert tone="error" live>
              {formError}
            </Alert>
          ) : null}
          <div className="actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={creating}
              aria-busy={creating}
            >
              {creating ? "만드는 중…" : "사례 만들기"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2 className="panel__title" style={{ margin: 0 }}>
            사례 목록
          </h2>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void loadCases()}
            disabled={loading}
          >
            다시 불러오기
          </button>
        </div>

        {error ? (
          <div style={{ marginTop: "0.85rem" }}>
            <Alert tone="error" live>
              {error}
            </Alert>
          </div>
        ) : null}

        {loading ? (
          <div className="stack" style={{ marginTop: "1rem" }} aria-busy="true">
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
            <p className="muted">목록을 불러오는 중…</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="empty" style={{ marginTop: "1rem" }}>
            아직 등록된 합성 사례가 없습니다.
          </div>
        ) : (
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="data">
              <caption className="visually-hidden">내 합성 사례 목록</caption>
              <thead>
                <tr>
                  <th scope="col">별칭</th>
                  <th scope="col">생성일</th>
                  <th scope="col">이동</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => (
                  <tr key={item.id}>
                    <td>{item.alias}</td>
                    <td>{formatSeoulDateTime(item.created_at)}</td>
                    <td>
                      <Link href={`/cases/${item.id}`}>열기</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default function CasesPage() {
  return (
    <RequireAuth>
      <CasesPageInner />
    </RequireAuth>
  );
}
