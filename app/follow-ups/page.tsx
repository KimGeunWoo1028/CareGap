"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import { AppHeader } from "@/components/app-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RequireAuth } from "@/components/require-auth";
import {
  apiRequest,
  userMessageForApiError,
  type ApiFailure,
} from "@/lib/api/client";
import { useAuthSession } from "@/lib/auth/session-context";
import type { FollowUpTask } from "@/lib/follow-ups/types";
import { formatSeoulDate, formatSeoulDateTime } from "@/lib/format";
import { readQueryParam, writeQueryParam } from "@/lib/url-state";

const KIND_LABEL: Record<FollowUpTask["kind"], string> = {
  next_consultation: "추가 상담",
  eligibility_check: "조건 확인",
  referral_outcome: "연계 결과",
};

const STATUS_LABEL: Record<FollowUpTask["status"], string> = {
  open: "대기",
  done: "완료",
  cancelled: "취소",
};

type FilterMode = "open" | "all";

function parseFilter(raw: string | null): FilterMode {
  return raw === "all" ? "all" : "open";
}

function caseLabel(task: FollowUpTask): string {
  const alias = task.case_alias?.trim();
  return alias && alias.length > 0 ? alias : "사례";
}

function followUpsReturnPath(filter: FilterMode): string {
  return filter === "all" ? "/follow-ups?status=all" : "/follow-ups";
}

function caseHref(
  task: FollowUpTask,
  filter: FilterMode,
  hash: string,
): string {
  const ret = encodeURIComponent(followUpsReturnPath(filter));
  return `/cases/${task.case_id}?return=${ret}${hash}`;
}

function truncateSummary(text: string, max = 140): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function FollowUpsInner() {
  const { accessToken, clearSession } = useAuthSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>(() =>
    typeof window !== "undefined"
      ? parseFilter(readQueryParam("status"))
      : "open",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    task: FollowUpTask;
    status: "done" | "cancelled";
  } | null>(null);

  const handleAuthFailure = useCallback(
    async (failure: ApiFailure) => {
      if (failure.status === 401 || failure.code === "UNAUTHENTICATED") {
        clearSession();
        router.replace("/login");
      }
    },
    [clearSession, router],
  );

  const loadTasks = useCallback(
    async (mode: FilterMode, options: { clearOnError?: boolean } = {}) => {
      setError(null);
      setLoading(true);
      const path =
        mode === "open" ? "/api/follow-ups?status=open" : "/api/follow-ups";
      const result = await apiRequest<FollowUpTask[]>(path, {
        token: accessToken,
      });
      if (!result.ok) {
        if (options.clearOnError !== false) {
          setTasks([]);
        }
        setError(userMessageForApiError(result));
        await handleAuthFailure(result);
        setLoading(false);
        return;
      }
      setTasks(result.data ?? []);
      setLoading(false);
    },
    [accessToken, handleAuthFailure],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const path =
        filter === "open" ? "/api/follow-ups?status=open" : "/api/follow-ups";
      const result = await apiRequest<FollowUpTask[]>(path, {
        token: accessToken,
      });
      if (cancelled) return;
      if (!result.ok) {
        setTasks([]);
        setError(userMessageForApiError(result));
        setLoading(false);
        await handleAuthFailure(result);
        return;
      }
      setTasks(result.data ?? []);
      setError(null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, filter, handleAuthFailure]);

  useEffect(() => {
    function onPopState() {
      setFilter(parseFilter(readQueryParam("status")));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function applyFilter(next: FilterMode) {
    writeQueryParam("status", next === "open" ? null : "all", {
      defaultValue: "open",
    });
    setFilter(next);
  }

  async function confirmTerminal() {
    if (!pending || !accessToken) return;
    const { task, status } = pending;
    setBusyId(task.id);
    const result = await apiRequest<FollowUpTask>(`/api/follow-ups/${task.id}`, {
      method: "PATCH",
      token: accessToken,
      body: { status },
    });
    setBusyId(null);
    if (!result.ok) {
      setError(userMessageForApiError(result));
      setPending(null);
      await handleAuthFailure(result);
      return;
    }
    setPending(null);
    await loadTasks(filter, { clearOnError: false });
  }

  return (
    <main className="page-frame work-deck follow-ups-page">
      <AppHeader onSignOut={() => router.replace("/login")} />
      <div className="line-board">
        <div className="line-board__spine" aria-hidden="true" />
        <div className="line-board__head">
          <h1 className="cases-title">후속 확인</h1>
          <p className="cases-lede">
            검토 뒤 추가 상담·조건 확인·연계 결과를 담당자가 직접 추적합니다.
            자동 자격 판정이나 신청은 하지 않습니다. 완료·취소는 되돌릴 수
            없습니다.
          </p>
        </div>

        <div className="panel line-board__bay">
          <div className="cases-toolbar">
            <div className="cases-toolbar__heading">
              <h2 className="panel__title">대기함</h2>
            </div>
            <div className="cases-toolbar__tools" role="group" aria-label="상태 필터">
              <button
                type="button"
                className={
                  filter === "open" ? "btn btn--primary" : "btn btn--ghost"
                }
                aria-pressed={filter === "open"}
                onClick={() => applyFilter("open")}
              >
                대기만
              </button>
              <button
                type="button"
                className={
                  filter === "all" ? "btn btn--primary" : "btn btn--ghost"
                }
                aria-pressed={filter === "all"}
                onClick={() => applyFilter("all")}
              >
                전체
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => applyFilter("open")}
              >
                필터 초기화
              </button>
              <Link href="/cases" className="btn btn--ghost">
                사례 목록
              </Link>
            </div>
          </div>

          {error ? (
            <div className="stack">
              <Alert tone="error" live title="목록을 불러오지 못했습니다">
                {error}
              </Alert>
              <div className="actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={loading || busyId !== null}
                  onClick={() => void loadTasks(filter)}
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <p className="muted" aria-live="polite">
              목록을 불러오는 중…
            </p>
          ) : null}

          {!loading && !error && tasks.length === 0 ? (
            <div className="empty cases-state">
              <p>
                {filter === "open"
                  ? "대기 중인 후속 확인이 없습니다."
                  : "저장된 후속 확인이 없습니다."}
              </p>
              <p className="muted">
                분석 검토에서 「추가 확인 필요」를 저장하면 여기에 나타납니다.
              </p>
            </div>
          ) : null}

          {!error ? (
            <ul className="follow-up-list">
              {tasks.map((task) => (
                <li key={task.id} className="follow-up-item">
                  <div>
                    <p className="follow-up-item__kind">
                      {KIND_LABEL[task.kind]} · {STATUS_LABEL[task.status]}
                    </p>
                    <p>
                      <span className="follow-up-item__case">
                        {caseLabel(task)}
                      </span>
                      {" · "}
                      {task.note || "(메모 없음)"}
                    </p>
                    {task.analysis_summary ? (
                      <p className="follow-up-item__summary muted">
                        연결된 분석 요약:{" "}
                        {truncateSummary(task.analysis_summary)}
                        {task.analysis_completed_at
                          ? ` · ${formatSeoulDateTime(task.analysis_completed_at)}`
                          : null}
                        {task.analysis_mode === "replay"
                          ? " · 시연(Replay)"
                          : task.analysis_mode === "live"
                            ? " · Live"
                            : null}
                      </p>
                    ) : task.analysis_id ? (
                      <p className="muted follow-up-item__summary">
                        연결된 분석이 있습니다. 요약 문구는 이 목록에 없어
                        사례 상세의 근거를 확인하세요.
                        {task.analysis_completed_at
                          ? ` · ${formatSeoulDateTime(task.analysis_completed_at)}`
                          : null}
                      </p>
                    ) : null}
                    <p className="muted">
                      <Link href={caseHref(task, filter, "")}>사례 열기</Link>
                      {task.analysis_id ? (
                        <>
                          {" · "}
                          <Link
                            href={caseHref(
                              task,
                              filter,
                              "#analysis-result-heading",
                            )}
                          >
                            분석 결과·근거
                          </Link>
                        </>
                      ) : (
                        <>
                          {" · "}
                          <Link
                            href={caseHref(task, filter, "#compare-heading")}
                          >
                            상담 비교로 이동
                          </Link>
                        </>
                      )}
                      {" · "}
                      생성 {formatSeoulDateTime(task.created_at)}
                      {task.due_on
                        ? ` · 기한 ${formatSeoulDate(task.due_on)}`
                        : null}
                    </p>
                  </div>
                  {task.status === "open" ? (
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={busyId !== null}
                        onClick={() =>
                          setPending({ task, status: "done" })
                        }
                      >
                        완료
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={busyId !== null}
                        onClick={() =>
                          setPending({ task, status: "cancelled" })
                        }
                      >
                        취소
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.status === "cancelled"
            ? "후속 확인을 취소할까요?"
            : "후속 확인을 완료할까요?"
        }
        confirmLabel={
          pending?.status === "cancelled" ? "취소 처리" : "완료 처리"
        }
        tone={pending?.status === "cancelled" ? "danger" : "primary"}
        busy={busyId !== null}
        onCancel={() => {
          if (busyId === null) setPending(null);
        }}
        onConfirm={() => void confirmTerminal()}
      >
        {pending ? (
          <>
            <p>
              <strong>{caseLabel(pending.task)}</strong>
              {" · "}
              {KIND_LABEL[pending.task.kind]}
            </p>
            <p>{pending.task.note || "(메모 없음)"}</p>
            <p className="muted">
              상태가{" "}
              <strong>
                {pending.status === "cancelled" ? "취소" : "완료"}
              </strong>
              로 바뀌며, 이후 다시 열 수 없습니다. 서버에 저장되기 전까지는
              목록이 바뀌지 않습니다.
            </p>
          </>
        ) : null}
      </ConfirmDialog>
    </main>
  );
}

export default function FollowUpsPage() {
  return (
    <RequireAuth>
      <FollowUpsInner />
    </RequireAuth>
  );
}
