"use client";

import { useCallback, useEffect, useState } from "react";
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
import type { FollowUpTask } from "@/lib/follow-ups/types";
import { formatSeoulDate, formatSeoulDateTime } from "@/lib/format";

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

function FollowUpsInner() {
  const { accessToken, clearSession, signOut } = useAuthSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const loadTasks = useCallback(async () => {
    setError(null);
    setLoading(true);
    const path =
      filter === "open" ? "/api/follow-ups?status=open" : "/api/follow-ups";
    const result = await apiRequest<FollowUpTask[]>(path, {
      token: accessToken,
    });
    if (!result.ok) {
      setTasks([]);
      setError(userMessageForApiError(result));
      await handleAuthFailure(result);
      setLoading(false);
      return;
    }
    setTasks(result.data ?? []);
    setLoading(false);
  }, [accessToken, filter, handleAuthFailure]);

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

  async function markTerminal(taskId: string, status: "done" | "cancelled") {
    if (!accessToken) return;
    setBusyId(taskId);
    const result = await apiRequest<FollowUpTask>(
      `/api/follow-ups/${taskId}`,
      {
        method: "PATCH",
        token: accessToken,
        body: { status },
      },
    );
    setBusyId(null);
    if (!result.ok) {
      setError(userMessageForApiError(result));
      await handleAuthFailure(result);
      return;
    }
    await loadTasks();
  }

  return (
    <main className="page-frame work-deck follow-ups-page">
      <AppHeader
        onSignOut={() => {
          void signOut();
          router.replace("/login");
        }}
      />
      <div className="line-board">
        <div className="line-board__spine" aria-hidden="true" />
        <div className="line-board__head">
          <h1 className="cases-title">후속 확인</h1>
          <p className="cases-lede">
            검토 뒤 추가 상담·조건 확인·연계 결과를 담당자가 직접 추적합니다.
            자동 자격 판정이나 신청은 하지 않습니다.
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
                onClick={() => {
                  setLoading(true);
                  setFilter("open");
                }}
              >
                대기만
              </button>
              <button
                type="button"
                className={
                  filter === "all" ? "btn btn--primary" : "btn btn--ghost"
                }
                aria-pressed={filter === "all"}
                onClick={() => {
                  setLoading(true);
                  setFilter("all");
                }}
              >
                전체
              </button>
              <Link href="/cases" className="btn btn--ghost">
                사례 목록
              </Link>
            </div>
          </div>

          {error ? <Alert tone="error">{error}</Alert> : null}

          {loading ? (
            <p className="muted">목록을 불러오는 중…</p>
          ) : null}

          {!loading && tasks.length === 0 ? (
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

          <ul className="follow-up-list">
            {tasks.map((task) => (
              <li key={task.id} className="follow-up-item">
                <div>
                  <p className="follow-up-item__kind">
                    {KIND_LABEL[task.kind]} · {STATUS_LABEL[task.status]}
                  </p>
                  <p>{task.note || "(메모 없음)"}</p>
                  <p className="muted">
                    사례{" "}
                    <Link href={`/cases/${task.case_id}`}>열기</Link>
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
                      disabled={busyId === task.id}
                      onClick={() => void markTerminal(task.id, "done")}
                    >
                      완료
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={busyId === task.id}
                      onClick={() => void markTerminal(task.id, "cancelled")}
                    >
                      취소
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
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
