"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import {
  apiRequest,
  userMessageForApiError,
  type ApiFailure,
} from "@/lib/api/client";
import { useAuthSession } from "@/lib/auth/session-context";
import type {
  AnalysisSummary,
  CaseDetail,
  ConsultationRecord,
} from "@/lib/cases/types";
import {
  analysisStatusLabel,
  channelLabel,
  codePointLength,
  formatSeoulDate,
  formatSeoulDateTime,
  seoulTodayIsoDate,
} from "@/lib/format";

function CaseDetailInner() {
  const params = useParams<{ case_id: string }>();
  const caseId = params.case_id;
  const { accessToken, clearSession, signOut } = useAuthSession();
  const router = useRouter();

  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [occurredOn, setOccurredOn] = useState(seoulTodayIsoDate());
  const [channel, setChannel] = useState<"phone" | "visit" | "other">("phone");
  const [body, setBody] = useState("");

  const bodyLength = codePointLength(body);
  const today = seoulTodayIsoDate();

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

  const loadDetail = useCallback(async () => {
    setError(null);
    setLoading(true);
    const result = await apiRequest<CaseDetail>(`/api/cases/${caseId}`, {
      token: accessToken,
    });
    if (!result.ok) {
      setDetail(null);
      setError(userMessageForApiError(result));
      await handleAuthFailure(result);
      setLoading(false);
      return;
    }
    setDetail(result.data);
    setLoading(false);
  }, [accessToken, caseId, handleAuthFailure]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiRequest<CaseDetail>(`/api/cases/${caseId}`, {
        token: accessToken,
      });
      if (cancelled) return;
      if (!result.ok) {
        setDetail(null);
        setError(userMessageForApiError(result));
        setLoading(false);
        await handleAuthFailure(result);
        return;
      }
      setDetail(result.data);
      setError(null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, caseId, handleAuthFailure]);

  const latestTwo = useMemo(() => {
    const notes = detail?.consultations ?? [];
    return notes.slice(0, 2);
  }, [detail]);

  const canAnalyze = (detail?.consultations.length ?? 0) >= 2;

  async function onSaveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!occurredOn) {
      setFormError("날짜를 입력해 주세요.");
      return;
    }
    if (occurredOn > today) {
      setFormError("서울 기준 미래 날짜는 저장할 수 없습니다.");
      return;
    }
    if (body.trim().length === 0) {
      setFormError("공백만 있는 원문은 저장할 수 없습니다.");
      return;
    }
    if (bodyLength < 1 || bodyLength > 2000) {
      setFormError("원문은 1~2,000자(유니코드 코드포인트)여야 합니다.");
      return;
    }

    setSaving(true);
    const result = await apiRequest<ConsultationRecord>(
      `/api/cases/${caseId}/consultations`,
      {
        method: "POST",
        token: accessToken,
        body: {
          occurred_on: occurredOn,
          channel,
          body,
        },
      },
    );
    setSaving(false);

    if (!result.ok) {
      setFormError(userMessageForApiError(result));
      await handleAuthFailure(result);
      return;
    }

    setBody("");
    setSuccessMessage("합성 기록을 저장했습니다.");
    await loadDetail();
  }

  return (
    <main className="page-frame">
      <AppHeader onSignOut={() => router.replace("/login")} />

      <p style={{ margin: "0 0 0.85rem" }}>
        <Link href="/cases">← 사례 목록</Link>
      </p>

      {loading ? (
        <section className="panel" aria-busy="true">
          <div className="skeleton" />
          <div className="skeleton" style={{ marginTop: "0.75rem" }} />
          <p className="muted">사례를 불러오는 중…</p>
        </section>
      ) : error ? (
        <section className="panel">
          <Alert tone="error" live>
            {error}
          </Alert>
          <div className="actions" style={{ marginTop: "0.85rem" }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void loadDetail()}
            >
              다시 시도
            </button>
            <Link className="btn btn--ghost" href="/cases">
              목록으로
            </Link>
          </div>
        </section>
      ) : detail ? (
        <>
          <section className="panel">
            <div className="actions" style={{ justifyContent: "space-between" }}>
              <div>
                <h1 className="panel__title" style={{ marginBottom: 0 }}>
                  {detail.case.alias}
                </h1>
                <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                  생성 {formatSeoulDateTime(detail.case.created_at)}
                </p>
              </div>
              <span className={`chip ${canAnalyze ? "chip--ready" : "chip--wait"}`}>
                {canAnalyze
                  ? "비교 준비됨 · 기록 2건 이상"
                  : "비교 준비 전 · 기록 부족"}
              </span>
            </div>

            <p className="lede" style={{ marginTop: "0.9rem" }}>
              날짜가 다른 최신 상담 기록 두 건을 비교 대상으로 사용합니다. 원문은
              저장 후 수정·삭제할 수 없습니다.
            </p>

            {!canAnalyze ? (
              <Alert tone="warning">
                서로 다른 날짜의 상담 기록이 2건 필요합니다.
              </Alert>
            ) : (
              <div className="compare-strip" aria-label="최신 두 상담 기록">
                {latestTwo.map((note, index) => (
                  <article key={note.id} className="compare-card">
                    <h3>
                      {index === 0 ? "현재(최신)" : "이전"} ·{" "}
                      {formatSeoulDate(note.occurred_on)} ·{" "}
                      {channelLabel(note.channel)}
                    </h3>
                    <p>{note.body}</p>
                  </article>
                ))}
              </div>
            )}

            <div className="actions" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="btn btn--primary"
                disabled
                title="분석 API는 Phase 4에서 연결됩니다."
              >
                새 분석 (준비 중)
              </button>
              <span className="muted">
                분석 생성 API는 아직 구현되지 않았습니다.
              </span>
            </div>
          </section>

          <div className="grid-two">
            <section className="panel">
              <h2 className="panel__title">합성 상담 기록 등록</h2>
              <p className="panel__desc">
                실제 개인정보가 포함되지 않은 합성 원문만 입력하세요.
              </p>

              <form className="stack" onSubmit={onSaveNote}>
                <div className="field">
                  <label htmlFor="occurred_on">상담 날짜</label>
                  <input
                    id="occurred_on"
                    name="occurred_on"
                    type="date"
                    max={today}
                    required
                    value={occurredOn}
                    onChange={(e) => setOccurredOn(e.target.value)}
                    disabled={saving}
                  />
                  <p className="field__hint">서울 기준 오늘({today}) 이하만 가능</p>
                </div>

                <div className="field">
                  <label htmlFor="channel">채널</label>
                  <select
                    id="channel"
                    name="channel"
                    value={channel}
                    onChange={(e) =>
                      setChannel(e.target.value as "phone" | "visit" | "other")
                    }
                    disabled={saving}
                  >
                    <option value="phone">전화</option>
                    <option value="visit">방문</option>
                    <option value="other">기타</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="body">합성 원문</label>
                  <textarea
                    id="body"
                    name="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={saving}
                    required
                    aria-describedby="body-count"
                  />
                  <div className="field__meta" id="body-count">
                    <span>앞뒤 공백과 줄바꿈을 그대로 저장합니다.</span>
                    <span>
                      {bodyLength} / 2,000
                      {bodyLength > 2000 ? " · 초과" : ""}
                    </span>
                  </div>
                </div>

                {formError ? (
                  <Alert tone="error" live>
                    {formError}
                  </Alert>
                ) : null}
                {successMessage ? (
                  <Alert tone="success" live>
                    {successMessage}
                  </Alert>
                ) : null}

                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving || bodyLength > 2000}
                  aria-busy={saving}
                >
                  {saving ? "저장 중…" : "합성 기록 저장"}
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="actions" style={{ justifyContent: "space-between" }}>
                <h2 className="panel__title" style={{ margin: 0 }}>
                  상담 기록
                </h2>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => void loadDetail()}
                >
                  새로고침
                </button>
              </div>
              <p className="panel__desc">최신 날짜 순 · 최대 50건 · 수정/삭제 없음</p>

              {detail.consultations.length === 0 ? (
                <div className="empty">아직 저장된 상담 기록이 없습니다.</div>
              ) : (
                detail.consultations.map((note) => (
                  <article key={note.id} className="note-card">
                    <div className="note-card__meta">
                      <span>{formatSeoulDate(note.occurred_on)}</span>
                      <span className="chip">{channelLabel(note.channel)}</span>
                      <span>저장 {formatSeoulDateTime(note.created_at)}</span>
                    </div>
                    <p className="note-card__body">{note.body}</p>
                  </article>
                ))
              )}
            </section>
          </div>

          <section className="panel">
            <h2 className="panel__title">분석 이력</h2>
            <p className="panel__desc">
              분석 생성·결과 화면은 이후 단계에서 연결됩니다. 지금은 서버에 저장된
              요약만 표시하며, 없는 결과를 가상으로 만들지 않습니다.
            </p>
            <AnalysisHistory analyses={detail.analyses} />
          </section>
        </>
      ) : null}
    </main>
  );
}

function AnalysisHistory({ analyses }: { analyses: AnalysisSummary[] }) {
  if (analyses.length === 0) {
    return <div className="empty">아직 분석 이력이 없습니다.</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data">
        <caption className="visually-hidden">분석 이력</caption>
        <thead>
          <tr>
            <th scope="col">생성</th>
            <th scope="col">상태</th>
            <th scope="col">모드</th>
            <th scope="col">현재 입력 기준</th>
            <th scope="col">완료</th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((item) => (
            <tr key={item.id}>
              <td>{formatSeoulDateTime(item.created_at)}</td>
              <td>{analysisStatusLabel(item.status)}</td>
              <td>{item.mode === "live" ? "live" : "replay"}</td>
              <td>{item.is_current ? "최신 두 기록과 일치" : "과거 분석"}</td>
              <td>{formatSeoulDateTime(item.completed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CaseDetailPage() {
  return (
    <RequireAuth>
      <CaseDetailInner />
    </RequireAuth>
  );
}
