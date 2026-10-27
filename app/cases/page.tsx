"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
import {
  filterCasesByAlias,
  isValidCaseAlias,
} from "@/lib/cases/list-query";
import type { CaseRecord } from "@/lib/cases/types";
import { formatSeoulDateTime } from "@/lib/format";

export function CasesPageInner() {
  const { accessToken, clearSession, signOut } = useAuthSession();
  const router = useRouter();
  const createPanelId = useId();
  const searchHintId = useId();
  const aliasHintId = useId();
  const aliasErrorId = useId();
  const createToggleRef = useRef<HTMLButtonElement>(null);
  const aliasInputRef = useRef<HTMLInputElement>(null);

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [alias, setAlias] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredCases = useMemo(
    () => filterCasesByAlias(cases, query),
    [cases, query],
  );
  const searchActive = query.trim().length > 0;

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

  function openCreatePanel() {
    setCreateOpen(true);
    setFormError(null);
    queueMicrotask(() => aliasInputRef.current?.focus());
  }

  function closeCreatePanel() {
    setCreateOpen(false);
    setFormError(null);
    queueMicrotask(() => createToggleRef.current?.focus());
  }

  function clearSearch() {
    setQuery("");
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const trimmed = alias.trim();
    if (!isValidCaseAlias(trimmed)) {
      setFormError("별칭은 합성-001 형식으로 입력해 주세요.");
      aliasInputRef.current?.focus();
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
      aliasInputRef.current?.focus();
      return;
    }
    setAlias("");
    setCreateOpen(false);
    router.push(`/cases/${result.data.id}`);
  }

  return (
    <main className="page-frame cases-page">
      <AppHeader onSignOut={() => router.replace("/login")} />

      <div className="cases-title-row">
        <div>
          <h1 className="cases-title">사례 목록</h1>
          <p className="cases-lede">
            상담 기록을 확인할 합성 사례를 선택하세요.
          </p>
        </div>
        <div className="cases-title-row__actions">
          <button
            ref={createToggleRef}
            type="button"
            className="btn btn--primary"
            aria-expanded={createOpen}
            aria-controls={createPanelId}
            onClick={() => {
              if (createOpen) closeCreatePanel();
              else openCreatePanel();
            }}
          >
            {createOpen ? "추가 닫기" : "사례 추가"}
          </button>
        </div>
      </div>

      {createOpen ? (
        <section
          className="panel cases-create"
          id={createPanelId}
          aria-labelledby="create-title"
        >
          <h2 id="create-title" className="panel__title">
            합성 사례 추가
          </h2>
          <p className="panel__desc">
            사례명은 합성-007처럼 입력합니다. 서버에 저장되며 본인 소유
            사례만 목록에 나타납니다.
          </p>
          <form className="cases-create__form" onSubmit={onCreate} noValidate>
            <div className="field">
              <label htmlFor="alias">사례명</label>
              <input
                ref={aliasInputRef}
                id="alias"
                name="alias"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="합성-007"
                autoComplete="off"
                disabled={creating}
                aria-invalid={formError ? true : undefined}
                aria-describedby={
                  formError ? `${aliasHintId} ${aliasErrorId}` : aliasHintId
                }
              />
              <p id={aliasHintId} className="field__hint">
                형식 합성-001 · 같은 별칭 중복 불가
              </p>
              {formError ? (
                <p id={aliasErrorId} className="field__error" role="alert">
                  {formError}
                </p>
              ) : null}
            </div>
            <div className="actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={creating}
                aria-busy={creating}
              >
                {creating ? "만드는 중…" : "사례 만들기"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closeCreatePanel}
                disabled={creating}
              >
                취소
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel cases-list" aria-labelledby="cases-heading">
        <div className="cases-toolbar">
          <div className="cases-toolbar__heading">
            <h2 id="cases-heading" className="panel__title">
              내 사례
            </h2>
            {!loading && !error ? (
              <p className="cases-count" aria-live="polite">
                표시 중 {filteredCases.length}건
                {searchActive ? ` · 불러온 ${cases.length}건 중` : null}
              </p>
            ) : null}
          </div>
          <div className="cases-toolbar__tools">
            <div className="cases-search">
              <label className="visually-hidden" htmlFor="case-search">
                현재 불러온 사례에서 검색
              </label>
              <input
                id="case-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="표시된 사례 검색"
                disabled={loading || !!error || cases.length === 0}
                aria-describedby={searchHintId}
              />
              <p id={searchHintId} className="field__hint">
                현재 불러온 사례에서 검색 · 등록일 최신순 · 최대 100건 조회(초과분은
                보이지 않을 수 있음)
              </p>
            </div>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void loadCases()}
              disabled={loading}
            >
              다시 불러오기
            </button>
          </div>
        </div>

        {error ? (
          <div className="cases-state">
            <Alert tone="error" live title="목록을 불러오지 못했습니다">
              {error}
            </Alert>
            <div className="actions" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void loadCases()}
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="cases-state stack" aria-busy="true">
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
            <p className="muted">목록을 불러오는 중…</p>
          </div>
        ) : null}

        {!loading && !error && cases.length === 0 ? (
          <div className="empty cases-state">
            <p>
              <strong>아직 등록된 합성 사례가 없습니다.</strong>
            </p>
            <p className="muted">사례 추가로 새 합성 사례를 만들 수 있습니다.</p>
            <div className="actions" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={openCreatePanel}
              >
                사례 추가
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error && cases.length > 0 && filteredCases.length === 0 ? (
          <div className="empty cases-state">
            <p>
              <strong>일치하는 사례가 없습니다.</strong>
            </p>
            <p className="muted">
              현재 불러온 사례명 안에서만 검색합니다. 검색어를 다시 확인해 주세요.
            </p>
            <div className="actions" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={clearSearch}
              >
                검색어 지우기
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error && filteredCases.length > 0 ? (
          <div className="table-wrap cases-table-wrap">
            <table className="data case-table">
              <caption className="visually-hidden">
                내 합성 사례 목록 · 등록일 최신순
              </caption>
              <thead>
                <tr>
                  <th scope="col">사례명</th>
                  <th scope="col">등록일</th>
                  <th scope="col">
                    <span className="visually-hidden">상세</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((item) => {
                  const registeredOn = formatSeoulDateTime(item.created_at);
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link
                          href={`/cases/${item.id}`}
                          className="case-link"
                        >
                          {item.alias}
                          <span className="visually-hidden">
                            {`, 등록일 ${registeredOn}, 상세 열기`}
                          </span>
                        </Link>
                      </td>
                      <td>
                        <time dateTime={item.created_at}>{registeredOn}</time>
                      </td>
                      <td className="case-table__chevron" aria-hidden="true">
                        <span className="case-row__arrow">→</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
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
