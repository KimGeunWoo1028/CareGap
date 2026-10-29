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
import { useParams, useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import { AnalysisResultPanel } from "@/components/analysis/analysis-result-panel";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import {
  apiRequest,
  userMessageForApiError,
  type ApiFailure,
} from "@/lib/api/client";
import { useAuthSession } from "@/lib/auth/session-context";
import {
  createCaseAnalysis,
  fetchAnalysisDetail,
  submitAnalysisReview,
} from "@/lib/cases/analysis-api";
import { POLL_INTERVAL_MS } from "@/lib/cases/analysis-labels";
import {
  analysisCurrencyLabel,
  analysisListCaption,
  analysisModeLabel,
  compareGuidance,
  consultationErrorField,
  consultationListCaption,
  pickLatestComparePair,
  type ConsultationFormField,
} from "@/lib/cases/detail-view";
import type {
  AnalysisDetail,
  AnalysisReviewRecord,
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

export function CaseDetailInner() {
  const params = useParams<{ case_id: string }>();
  const caseId = params.case_id;
  const { accessToken, clearSession, signOut } = useAuthSession();
  const router = useRouter();

  const dateHintId = useId();
  const dateErrorId = useId();
  const channelHintId = useId();
  const channelErrorId = useId();
  const bodyHintId = useId();
  const bodyErrorId = useId();
  const formErrorId = useId();

  const dateInputRef = useRef<HTMLInputElement>(null);
  const channelSelectRef = useRef<HTMLSelectElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);

  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorField, setFormErrorField] =
    useState<ConsultationFormField | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [occurredOn, setOccurredOn] = useState(seoulTodayIsoDate());
  const [channel, setChannel] = useState<"phone" | "visit" | "other">("phone");
  const [body, setBody] = useState("");

  const [selectedAnalysis, setSelectedAnalysis] =
    useState<AnalysisDetail | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bodyLength = codePointLength(body);
  const today = seoulTodayIsoDate();

  const guidance = useMemo(
    () => compareGuidance(detail?.consultations ?? []),
    [detail],
  );
  const comparePair = useMemo(
    () => pickLatestComparePair(detail?.consultations ?? []),
    [detail],
  );
  const hasProcessing = useMemo(
    () => (detail?.analyses ?? []).some((item) => item.status === "processing"),
    [detail],
  );

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

  const focusFormField = useCallback((field: ConsultationFormField) => {
    queueMicrotask(() => {
      if (field === "occurred_on") dateInputRef.current?.focus();
      else if (field === "channel") channelSelectRef.current?.focus();
      else if (field === "body") bodyInputRef.current?.focus();
    });
  }, []);

  const showFormFailure = useCallback(
    (message: string, field: ConsultationFormField) => {
      setFormError(message);
      setFormErrorField(field);
      focusFormField(field);
    },
    [focusFormField],
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

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

  const applyAnalysisDetail = useCallback((data: AnalysisDetail) => {
    setSelectedAnalysis(data);
    if (data.status !== "processing") {
      stopPolling();
      setAnalysisBusy(false);
      idempotencyKeyRef.current = null;
    }
  }, [stopPolling]);

  const loadAnalysisById = useCallback(
    async (analysisId: string) => {
      if (!accessToken) return;
      setAnalysisError(null);
      const result = await fetchAnalysisDetail(analysisId, accessToken);
      if (!result.ok) {
        setAnalysisError(userMessageForApiError(result));
        await handleAuthFailure(result);
        return;
      }
      applyAnalysisDetail(result.data);
    },
    [accessToken, applyAnalysisDetail, handleAuthFailure],
  );

  const startPolling = useCallback(
    (analysisId: string) => {
      stopPolling();
      pollTimerRef.current = setInterval(() => {
        void loadAnalysisById(analysisId);
        void loadDetail();
      }, POLL_INTERVAL_MS);
    },
    [loadAnalysisById, loadDetail, stopPolling],
  );

  const onStartAnalysis = useCallback(async () => {
    if (!accessToken || !guidance.ready || analysisBusy || hasProcessing) {
      return;
    }
    setAnalysisError(null);
    setReviewError(null);
    setAnalysisBusy(true);

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    const key = idempotencyKeyRef.current;
    const result = await createCaseAnalysis(caseId, accessToken, key);
    if (!result.ok) {
      setAnalysisBusy(false);
      if (
        result.code === "ANALYSIS_FAILED" ||
        result.code === "IDEMPOTENCY_CONFLICT" ||
        result.code === "REPLAY_UNAVAILABLE" ||
        result.code === "INVALID_AI_OUTPUT" ||
        result.code === "AI_UNAVAILABLE" ||
        result.code === "TIMEOUT"
      ) {
        idempotencyKeyRef.current = null;
      }
      setAnalysisError(userMessageForApiError(result));
      await handleAuthFailure(result);
      if (typeof result.details.analysis_id === "string") {
        await loadAnalysisById(result.details.analysis_id);
      }
      await loadDetail();
      return;
    }

    applyAnalysisDetail(result.data);
    await loadDetail();
    if (result.data.status === "processing" || result.status === 202) {
      startPolling(result.data.id);
    } else {
      setAnalysisBusy(false);
      idempotencyKeyRef.current = null;
    }
  }, [
    accessToken,
    analysisBusy,
    applyAnalysisDetail,
    caseId,
    guidance.ready,
    handleAuthFailure,
    hasProcessing,
    loadAnalysisById,
    loadDetail,
    startPolling,
  ]);

  const onSubmitReview = useCallback(
    async (decision: AnalysisReviewRecord["decision"], note: string) => {
      if (!accessToken || !selectedAnalysis) return;
      setReviewSubmitting(true);
      setReviewError(null);
      const result = await submitAnalysisReview(
        selectedAnalysis.id,
        accessToken,
        decision,
        note,
      );
      setReviewSubmitting(false);
      if (!result.ok) {
        setReviewError(userMessageForApiError(result));
        await handleAuthFailure(result);
        return;
      }
      await loadAnalysisById(selectedAnalysis.id);
      await loadDetail();
    },
    [
      accessToken,
      handleAuthFailure,
      loadAnalysisById,
      loadDetail,
      selectedAnalysis,
    ],
  );

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

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    if (!detail || !accessToken) return;
    const processing = detail.analyses.find(
      (item) => item.status === "processing",
    );
    if (!processing) return;

    const analysisId = processing.id;
    const needsLoad = selectedAnalysis?.id !== analysisId;
    // Defer so this effect only schedules external work (poll/fetch), not sync setState.
    const handle = window.setTimeout(() => {
      if (needsLoad) {
        void loadAnalysisById(analysisId);
      }
      if (!pollTimerRef.current) {
        startPolling(analysisId);
      }
    }, 0);
    return () => {
      window.clearTimeout(handle);
    };
  }, [
    accessToken,
    detail,
    loadAnalysisById,
    selectedAnalysis,
    startPolling,
  ]);

  async function onSaveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setFormError(null);
    setFormErrorField(null);
    setSuccessMessage(null);

    if (!occurredOn) {
      showFormFailure("날짜를 입력해 주세요.", "occurred_on");
      return;
    }
    if (occurredOn > today) {
      showFormFailure(
        "서울 기준 미래 날짜는 저장할 수 없습니다.",
        "occurred_on",
      );
      return;
    }
    if (body.trim().length === 0) {
      showFormFailure("공백만 있는 원문은 저장할 수 없습니다.", "body");
      return;
    }
    if (bodyLength < 1 || bodyLength > 2000) {
      showFormFailure(
        "원문은 1~2,000자(유니코드 코드포인트)여야 합니다.",
        "body",
      );
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
      const message = userMessageForApiError(result);
      const field = consultationErrorField(result.code, message);
      showFormFailure(message, field);
      await handleAuthFailure(result);
      return;
    }

    setBody("");
    setFormError(null);
    setFormErrorField(null);
    setSuccessMessage("합성 기록을 저장했습니다.");
    await loadDetail();
  }

  return (
    <main className="page-frame work-deck detail-page">
      <AppHeader onSignOut={() => router.replace("/login")} />

      <nav className="detail-breadcrumb route-crumbs" aria-label="사례 위치">
        <Link href="/cases" className="detail-breadcrumb__back">
          ← 사례 목록
        </Link>
        {detail ? (
          <>
            <span className="detail-breadcrumb__sep" aria-hidden="true">
              /
            </span>
            <span className="detail-breadcrumb__current">{detail.case.alias}</span>
          </>
        ) : null}
      </nav>

      {loading ? (
        <section className="panel detail-state" aria-busy="true">
          <div className="skeleton" />
          <div className="skeleton" style={{ marginTop: "0.75rem" }} />
          <p className="muted">사례를 불러오는 중…</p>
        </section>
      ) : null}

      {!loading && error ? (
        <section className="panel detail-state">
          <Alert tone="error" live title="사례를 불러오지 못했습니다">
            {error}
          </Alert>
          <p className="field__hint" style={{ marginTop: "0.65rem" }}>
            존재하지 않거나 접근할 수 없는 사례는 같은 안내로 표시됩니다.
          </p>
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
      ) : null}

      {!loading && !error && detail ? (
        <>
          <header className="detail-title-row station-nameplate">
            <div>
              <h1 className="detail-title">{detail.case.alias}</h1>
              <p className="detail-lede">
                생성 {formatSeoulDateTime(detail.case.created_at)} · 합성
                상담 원문을 먼저 읽고, 이전·현재 노선이 만나는 지점에서 변화를
                확인한 뒤 기록을 추가하세요.
              </p>
            </div>
            <span
              className={`chip ${guidance.ready ? "chip--ready" : "chip--wait"}`}
            >
              {guidance.ready
                ? `비교 준비됨 · 기록 ${guidance.count}건`
                : `비교 준비 전 · 기록 ${guidance.count}건`}
            </span>
          </header>

          <section
            className="panel detail-compare interchange-plaza"
            aria-labelledby="compare-heading"
          >
            <div className="detail-section-head interchange-plaza__head">
              <h2 id="compare-heading" className="panel__title">
                {guidance.title}
              </h2>
              {guidance.ready ? (
                <p className="panel__desc">{guidance.detail}</p>
              ) : null}
            </div>

            {!guidance.ready ? (
              <div className="detail-guidance">
                <Alert tone="warning">
                  {guidance.detail} {guidance.nextAction}
                </Alert>
              </div>
            ) : comparePair ? (
              <div
                className="compare-strip interchange-plaza__tracks"
                aria-label="최신 두 상담 기록"
              >
                <div className="interchange-plaza__hub" aria-hidden="true">
                  <span className="interchange-plaza__hub-core" />
                </div>
                <article className="compare-card compare-card--previous">
                  <p className="compare-card__role">이전 상담</p>
                  <h3 className="compare-card__heading">
                    {formatSeoulDate(comparePair.previous.occurred_on)} ·{" "}
                    {channelLabel(comparePair.previous.channel)}
                  </h3>
                  <p className="compare-card__body">
                    {comparePair.previous.body}
                  </p>
                </article>
                <article className="compare-card compare-card--current">
                  <p className="compare-card__role">현재(최신) 상담</p>
                  <h3 className="compare-card__heading">
                    {formatSeoulDate(comparePair.current.occurred_on)} ·{" "}
                    {channelLabel(comparePair.current.channel)}
                  </h3>
                  <p className="compare-card__body">
                    {comparePair.current.body}
                  </p>
                </article>
              </div>
            ) : null}

            <div className="detail-analyze-row interchange-plaza__ops">
              <button
                type="button"
                className="btn btn--primary"
                disabled={
                  !guidance.ready || analysisBusy || hasProcessing || saving
                }
                aria-disabled={
                  !guidance.ready || analysisBusy || hasProcessing || saving
                }
                aria-busy={analysisBusy || hasProcessing}
                onClick={() => {
                  void onStartAnalysis();
                }}
              >
                {analysisBusy || hasProcessing
                  ? "분석 진행 중…"
                  : guidance.ready
                    ? "새 분석"
                    : "새 분석 (기록 2건 필요)"}
              </button>
              <p className="detail-analyze-note">
                {!guidance.ready
                  ? "서로 다른 날짜의 상담 기록 2건이 필요합니다. 조건을 충족하면 비교 분석을 시작할 수 있습니다."
                  : "최근 서로 다른 날짜의 두 상담 기록을 비교합니다. 조건에 맞지 않으면 분석을 시작하지 않으며, 다른 방식으로 결과를 바꾸지 않습니다."}
              </p>
            </div>
            {analysisError ? (
              <Alert tone="error" live title="분석을 시작하지 못했습니다">
                {analysisError}
              </Alert>
            ) : null}
          </section>

          {selectedAnalysis ? (
            <AnalysisResultPanel
              analysis={selectedAnalysis}
              consultations={detail.consultations}
              reviewSubmitting={reviewSubmitting}
              reviewError={reviewError}
              onSubmitReview={
                selectedAnalysis.status === "succeeded" &&
                !selectedAnalysis.review
                  ? onSubmitReview
                  : undefined
              }
            />
          ) : null}

          <div className="detail-work-grid detail-dock">
            <section
              className="panel detail-form-panel"
              aria-labelledby="consult-form-heading"
            >
              <h2 id="consult-form-heading" className="panel__title">
                합성 상담 기록 등록
              </h2>
              <p className="panel__desc">
                실제 개인정보가 포함되지 않은 합성 원문만 입력하세요. 서울 기준
                오늘 이하 날짜, 전화·방문·기타, 1~2,000 Unicode 코드포인트.
              </p>

              <form
                className="stack detail-form"
                onSubmit={onSaveNote}
                noValidate
                aria-busy={saving}
              >
                <div className="field">
                  <label htmlFor="occurred_on">상담 날짜</label>
                  <input
                    ref={dateInputRef}
                    id="occurred_on"
                    name="occurred_on"
                    type="date"
                    max={today}
                    required
                    value={occurredOn}
                    onChange={(e) => setOccurredOn(e.target.value)}
                    disabled={saving}
                    aria-invalid={
                      formErrorField === "occurred_on" ? true : undefined
                    }
                    aria-describedby={
                      formErrorField === "occurred_on"
                        ? `${dateHintId} ${dateErrorId}`
                        : dateHintId
                    }
                  />
                  <p id={dateHintId} className="field__hint">
                    서울 기준 오늘({today}) 이하 · 같은 날짜 중복 불가
                  </p>
                  {formErrorField === "occurred_on" && formError ? (
                    <p id={dateErrorId} className="field__error" role="alert">
                      {formError}
                    </p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="channel">채널</label>
                  <select
                    ref={channelSelectRef}
                    id="channel"
                    name="channel"
                    value={channel}
                    onChange={(e) =>
                      setChannel(
                        e.target.value as "phone" | "visit" | "other",
                      )
                    }
                    disabled={saving}
                    aria-invalid={
                      formErrorField === "channel" ? true : undefined
                    }
                    aria-describedby={
                      formErrorField === "channel"
                        ? `${channelHintId} ${channelErrorId}`
                        : channelHintId
                    }
                  >
                    <option value="phone">전화</option>
                    <option value="visit">방문</option>
                    <option value="other">기타</option>
                  </select>
                  <p id={channelHintId} className="field__hint">
                    전화 · 방문 · 기타
                  </p>
                  {formErrorField === "channel" && formError ? (
                    <p
                      id={channelErrorId}
                      className="field__error"
                      role="alert"
                    >
                      {formError}
                    </p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="body">합성 원문</label>
                  <textarea
                    ref={bodyInputRef}
                    id="body"
                    name="body"
                    className="detail-body-input"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={saving}
                    required
                    rows={5}
                    aria-invalid={formErrorField === "body" ? true : undefined}
                    aria-describedby={
                      formErrorField === "body"
                        ? `${bodyHintId} ${bodyErrorId}`
                        : bodyHintId
                    }
                  />
                  <div className="field__meta" id={bodyHintId}>
                    <span>
                      앞뒤 공백과 줄바꿈을 그대로 저장합니다. 공백만 입력은
                      불가합니다.
                    </span>
                    <span>
                      {bodyLength.toLocaleString("ko-KR")} / 2,000
                      {bodyLength > 2000 ? " · 초과" : ""}
                    </span>
                  </div>
                  {formErrorField === "body" && formError ? (
                    <p id={bodyErrorId} className="field__error" role="alert">
                      {formError}
                    </p>
                  ) : null}
                </div>

                {formErrorField === "form" && formError ? (
                  <Alert tone="error" live title="저장하지 못했습니다">
                    <span id={formErrorId}>{formError}</span>
                    <span className="detail-form-recovery">
                      {" "}
                      작성 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.
                    </span>
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

            <div className="detail-dock__stack">
              <section
                className="panel detail-notes-panel note-route"
                aria-labelledby="notes-heading"
              >
                <div className="detail-section-head detail-section-head--row">
                  <div>
                    <h2 id="notes-heading" className="panel__title">
                      상담 기록
                    </h2>
                    <p className="panel__desc">
                      {consultationListCaption(detail.consultations.length)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => void loadDetail()}
                  >
                    다시 불러오기
                  </button>
                </div>

                {detail.consultations.length === 0 ? (
                  <div className="empty">
                    <p className="empty__title">
                      아직 저장된 상담 기록이 없습니다.
                    </p>
                    <p>
                      왼쪽(모바일에서는 위) 등록 폼에서 합성 원문을 저장하면 이
                      목록에 나타납니다.
                    </p>
                  </div>
                ) : (
                  <ul className="note-list note-route__stops">
                    {detail.consultations.map((note) => (
                      <li key={note.id}>
                        <article className="note-card">
                          <div className="note-card__meta">
                            <span>
                              상담일 {formatSeoulDate(note.occurred_on)}
                            </span>
                            <span className="chip">
                              {channelLabel(note.channel)}
                            </span>
                            <span>
                              저장 {formatSeoulDateTime(note.created_at)}
                            </span>
                          </div>
                          <p className="note-card__body">{note.body}</p>
                        </article>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section
                className="panel detail-history-panel"
                aria-labelledby="history-heading"
              >
                <h2 id="history-heading" className="panel__title">
                  분석 이력
                </h2>
                <p className="panel__desc">
                  {analysisListCaption(detail.analyses.length)}. 행을 선택하면
                  위 결과 패널에서 상세·검토를 확인할 수 있습니다.
                </p>
                <AnalysisHistory
                  analyses={detail.analyses}
                  selectedId={selectedAnalysis?.id ?? null}
                  onSelect={(id) => {
                    setAnalysisError(null);
                    void loadAnalysisById(id);
                  }}
                />
              </section>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}

function AnalysisHistory({
  analyses,
  selectedId,
  onSelect,
}: {
  analyses: AnalysisSummary[];
  selectedId: string | null;
  onSelect: (analysisId: string) => void;
}) {
  if (analyses.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">아직 분석 이력이 없습니다.</p>
        <p>새 분석을 실행하면 여기에 요약이 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap detail-history-table">
      <table className="data">
        <caption className="visually-hidden">분석 이력 요약</caption>
        <thead>
          <tr>
            <th scope="col">생성</th>
            <th scope="col">상태</th>
            <th scope="col">모드</th>
            <th scope="col">최신 여부</th>
            <th scope="col">완료</th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((item) => {
            const selected = item.id === selectedId;
            const rowClass = [
              item.is_current ? "" : "detail-history-row--stale",
              selected ? "detail-history-row--selected" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <tr key={item.id} className={rowClass || undefined}>
                <td>
                  <button
                    type="button"
                    className="linkish detail-history-select"
                    onClick={() => onSelect(item.id)}
                    aria-current={selected ? "true" : undefined}
                  >
                    {formatSeoulDateTime(item.created_at)}
                  </button>
                </td>
                <td>
                  <span className={`chip chip--status-${item.status}`}>
                    {analysisStatusLabel(item.status)}
                  </span>
                </td>
                <td>{analysisModeLabel(item.mode)}</td>
                <td>
                  {item.is_current ? (
                    analysisCurrencyLabel(item)
                  ) : (
                    <span className="detail-stale-flag">
                      {analysisCurrencyLabel(item)}
                    </span>
                  )}
                </td>
                <td>{formatSeoulDateTime(item.completed_at)}</td>
              </tr>
            );
          })}
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
