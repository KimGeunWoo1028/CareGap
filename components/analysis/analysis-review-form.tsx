"use client";

import { useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/alert";
import { codePointLength } from "@/lib/format";
import type { AnalysisReviewRecord } from "@/lib/cases/types";
import { reviewDecisionLabel } from "@/lib/cases/analysis-labels";

type Props = {
  disabled?: boolean;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (
    decision: AnalysisReviewRecord["decision"],
    note: string,
  ) => Promise<void> | void;
};

export function AnalysisReviewForm({
  disabled = false,
  submitting = false,
  error = null,
  onSubmit,
}: Props) {
  const noteId = useId();
  const errorId = useId();
  const [decision, setDecision] =
    useState<AnalysisReviewRecord["decision"]>("needs_followup");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const noteLength = codePointLength(note);
  const busy = disabled || submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (noteLength > 500) {
      setLocalError("검토 메모는 최대 500자입니다.");
      return;
    }
    if (decision === "rejected" && note.trim().length === 0) {
      setLocalError("결과 부적절을 선택한 경우 사유를 입력해 주세요.");
      return;
    }
    await onSubmit(decision, note);
  }

  return (
    <form className="stack analysis-review-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="analysis-review-form__choices" disabled={busy}>
        <legend className="analysis-section-title">담당자 검토 결정</legend>
        {(
          [
            "confirmed",
            "needs_followup",
            "rejected",
          ] as AnalysisReviewRecord["decision"][]
        ).map((value) => (
          <label key={value} className="analysis-review-form__option">
            <input
              type="radio"
              name="decision"
              value={value}
              checked={decision === value}
              onChange={() => setDecision(value)}
            />
            <span>{reviewDecisionLabel(value)}</span>
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor={noteId}>검토 메모</label>
        <textarea
          id={noteId}
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
          rows={4}
          aria-invalid={localError || error ? true : undefined}
          aria-describedby={localError || error ? errorId : undefined}
        />
        <div className="field__meta">
          <span>
            반려(결과 부적절)만 사유가 필수입니다. 검토 저장은 연계 완료나 자격
            확정이 아닙니다.
          </span>
          <span>
            {noteLength.toLocaleString("ko-KR")} / 500
            {noteLength > 500 ? " · 초과" : ""}
          </span>
        </div>
      </div>

      {localError || error ? (
        <Alert tone="error" live>
          <span id={errorId}>{localError ?? error}</span>
        </Alert>
      ) : null}

      <button
        type="submit"
        className="btn btn--primary"
        disabled={busy || noteLength > 500}
        aria-busy={submitting}
      >
        {submitting ? "저장 중…" : "검토 저장"}
      </button>
    </form>
  );
}
