"use client";

import { Alert } from "@/components/alert";
import { AnalysisReviewForm } from "@/components/analysis/analysis-review-form";
import {
  analysisModeBanner,
  changeStatusLabel,
  DOMAIN_ORDER,
  domainLabel,
  EMPTY_RECOMMENDATIONS_COPY,
  matchedDomainsLabel,
  reviewDecisionLabel,
} from "@/lib/cases/analysis-labels";
import type {
  AnalysisDetail,
  AnalysisReviewRecord,
  ConsultationRecord,
} from "@/lib/cases/types";
import {
  channelLabel,
  formatSeoulDate,
  formatSeoulDateTime,
} from "@/lib/format";

type Props = {
  analysis: AnalysisDetail;
  consultations: ConsultationRecord[];
  reviewSubmitting?: boolean;
  reviewError?: string | null;
  onSubmitReview?: (
    decision: AnalysisReviewRecord["decision"],
    note: string,
  ) => Promise<void> | void;
};

function noteById(
  consultations: ConsultationRecord[],
  noteId: string,
): ConsultationRecord | null {
  return consultations.find((row) => row.id === noteId) ?? null;
}

export function AnalysisResultPanel({
  analysis,
  consultations,
  reviewSubmitting = false,
  reviewError = null,
  onSubmitReview,
}: Props) {
  const previous = noteById(consultations, analysis.previous_note_id);
  const current = noteById(consultations, analysis.current_note_id);
  const payload = analysis.result;

  return (
    <section
      className="panel analysis-result-panel"
      aria-labelledby="analysis-result-heading"
    >
      <div className="analysis-result-panel__head">
        <h2 id="analysis-result-heading" className="panel__title">
          분석 결과
        </h2>
        <p className="panel__desc analysis-result-panel__mode" role="status">
          {analysisModeBanner(analysis.mode)}
        </p>
        <p className="analysis-result-panel__meta muted">
          생성 {formatSeoulDateTime(analysis.created_at)}
          {analysis.completed_at
            ? ` · 완료 ${formatSeoulDateTime(analysis.completed_at)}`
            : ""}
          {analysis.mode === "live" && analysis.model
            ? ` · 모델 ${analysis.model}`
            : ""}
        </p>
      </div>

      {!analysis.is_current ? (
        <Alert tone="warning" title="이전 분석">
          새 상담 기록이 추가된 이전 분석입니다. 최신 두 기록과 다를 수 있으니
          원문을 함께 확인하세요.
        </Alert>
      ) : null}

      {analysis.status === "processing" ? (
        <Alert tone="info" live title="분석 처리 중">
          분석이 진행 중입니다. 잠시 후 상태가 자동으로 갱신됩니다. 실패한
          분석을 다른 방식으로 자동 바꾸지 않습니다.
        </Alert>
      ) : null}

      {analysis.status === "failed" ? (
        <Alert tone="error" title="분석 실패">
          이 분석은 실패로 끝났습니다. 원문은 그대로 보관됩니다. 새 분석으로
          다시 시도하거나 원문을 직접 검토해 주세요.
        </Alert>
      ) : null}

      {analysis.status === "succeeded" && payload ? (
        <>
          <div className="analysis-domain-grid" id="analysis-domains">
            <h3 className="analysis-section-title">상태 변화 (4범주)</h3>
            <p className="muted analysis-caveat">
              색상만으로 판단하지 말고 상태 문구와 원문 근거를 함께 확인하세요.
            </p>
            {DOMAIN_ORDER.map((domain) => {
              const change = payload.analysis.changes.find(
                (item) => item.domain === domain,
              );
              if (!change) return null;
              return (
                <article
                  key={domain}
                  className={`analysis-domain-card analysis-domain-card--${change.status}`}
                >
                  <header className="analysis-domain-card__head">
                    <h4>{domainLabel(domain)}</h4>
                    <span
                      className={`chip chip--change-${change.status}`}
                    >
                      {changeStatusLabel(change.status)}
                    </span>
                  </header>
                  <p className="analysis-domain-card__explanation">
                    {change.explanation}
                  </p>
                  <dl className="analysis-evidence">
                    <div>
                      <dt>이전 근거</dt>
                      <dd>
                        {change.evidence_previous ? (
                          <q className="analysis-quote">
                            {change.evidence_previous.quote}
                          </q>
                        ) : (
                          <span className="muted">기록에서 확인되지 않음</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>현재 근거</dt>
                      <dd>
                        {change.evidence_current ? (
                          <q className="analysis-quote">
                            {change.evidence_current.quote}
                          </q>
                        ) : (
                          <span className="muted">기록에서 확인되지 않음</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>

          <div className="analysis-summary-block">
            <h3 className="analysis-section-title">분석 요약</h3>
            <p className="analysis-summary-text">{payload.analysis.summary}</p>
            <p className="muted analysis-caveat">
              AI는 기록상 변화를 정리할 뿐 의료 진단·자격 확정을 하지 않습니다.
              각 주장은 원문 근거와 함께 판단하세요.
            </p>
          </div>

          <div className="analysis-compare-notes">
            <h3 className="analysis-section-title">분석에 사용된 상담 원문</h3>
            <div className="analysis-compare-grid">
              <article className="analysis-note-card analysis-note-card--previous">
                <p className="compare-card__role">이전 상담</p>
                <h4 className="compare-card__heading">
                  {previous
                    ? `${formatSeoulDate(previous.occurred_on)} · ${channelLabel(previous.channel)}`
                    : "기록 없음"}
                </h4>
                <p className="compare-card__body analysis-note-body">
                  {previous?.body ?? "—"}
                </p>
              </article>
              <article className="analysis-note-card analysis-note-card--current">
                <p className="compare-card__role">현재 상담</p>
                <h4 className="compare-card__heading">
                  {current
                    ? `${formatSeoulDate(current.occurred_on)} · ${channelLabel(current.channel)}`
                    : "기록 없음"}
                </h4>
                <p className="compare-card__body analysis-note-body">
                  {current?.body ?? "—"}
                </p>
              </article>
            </div>
          </div>

          <div className="analysis-questions">
            <h3 className="analysis-section-title">추가 확인 질문</h3>
            {payload.analysis.questions.length === 0 ? (
              <p className="muted">추가 질문 없음</p>
            ) : (
              <>
                <p className="muted analysis-caveat">
                  담당자가 추가 상담에서 확인할 사항이며 확정적 판단이나 의학적
                  지시가 아닙니다.
                </p>
                <ol className="analysis-questions__list">
                  {payload.analysis.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ol>
              </>
            )}
          </div>

          <div className="analysis-recommendations">
            <h3 className="analysis-section-title">복지사업 연계 후보</h3>
            {payload.recommendations.length === 0 ? (
              <p>{EMPTY_RECOMMENDATIONS_COPY}</p>
            ) : (
              <ul className="analysis-recommendations__list">
                {payload.recommendations.map((item) => (
                  <li key={item.program_id} className="analysis-rec-card">
                    <div className="analysis-rec-card__head">
                      <h4>{item.name}</h4>
                      <span className="chip chip--unverified">자격 미확인</span>
                    </div>
                    <p>{item.summary}</p>
                    <p className="muted">
                      관련 변화: {matchedDomainsLabel(item.matched_domains)} ·
                      지역 {item.region}
                    </p>
                    <p className="muted">
                      출처 확인일 {item.source_checked_on} · catalog{" "}
                      {item.catalog_version}
                    </p>
                    <p>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        공식 출처 열기 (새 창)
                      </a>
                    </p>
                    <div>
                      <p className="analysis-rec-card__checks-label">
                        추가 확인 필요 사항
                      </p>
                      <ul>
                        {item.eligibility_checks.map((check) => (
                          <li key={check}>{check}</li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted analysis-caveat">
              후보는 담당자 검토용 정보이며 수급 가능·자동 신청을 의미하지
              않습니다.
            </p>
          </div>

          <div className="analysis-review">
            <h3 className="analysis-section-title">담당자 검토</h3>
            {analysis.review ? (
              <div className="analysis-review-readonly">
                <p>
                  <strong>{reviewDecisionLabel(analysis.review.decision)}</strong>
                  <span className="muted">
                    {" "}
                    · 저장 {formatSeoulDateTime(analysis.review.created_at)}
                  </span>
                </p>
                <p className="analysis-review-note">
                  {analysis.review.note.trim().length > 0
                    ? analysis.review.note
                    : "(메모 없음)"}
                </p>
                <p className="muted analysis-caveat">
                  검토 저장은 연계 완료나 지원 결정의 증거가 아닙니다. 이 분석의
                  검토는 이미 저장되어 수정할 수 없습니다.
                </p>
              </div>
            ) : onSubmitReview ? (
              <AnalysisReviewForm
                submitting={reviewSubmitting}
                error={reviewError}
                onSubmit={onSubmitReview}
              />
            ) : (
              <p className="muted">검토를 작성할 수 없습니다.</p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
