import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import replayFixture from "@/fixtures/replay-analysis.json";
import { DEMO_WELFARE_PROGRAMS } from "@/lib/matching/demo-programs";

const callStartAnalysis = vi.fn();
const getAnalysisRowForOwner = vi.fn();
const getAnalysisDetail = vi.fn();
const getCaseAlias = vi.fn();
const getConsultationPair = vi.fn();
const listActiveWelfarePrograms = vi.fn();
const finalizeAnalysisSuccess = vi.fn();
const finalizeAnalysisFailure = vi.fn();
const insertReview = vi.fn();
const runAnalysis = vi.fn();
const getServerEnv = vi.fn();

vi.mock("@/lib/analysis/repository", () => ({
  callStartAnalysis: (...args: unknown[]) => callStartAnalysis(...args),
  getAnalysisRowForOwner: (...args: unknown[]) =>
    getAnalysisRowForOwner(...args),
  getAnalysisDetail: (...args: unknown[]) => getAnalysisDetail(...args),
  getCaseAlias: (...args: unknown[]) => getCaseAlias(...args),
  getConsultationPair: (...args: unknown[]) => getConsultationPair(...args),
  listActiveWelfarePrograms: (...args: unknown[]) =>
    listActiveWelfarePrograms(...args),
  finalizeAnalysisSuccess: (...args: unknown[]) =>
    finalizeAnalysisSuccess(...args),
  finalizeAnalysisFailure: (...args: unknown[]) =>
    finalizeAnalysisFailure(...args),
  insertReview: (...args: unknown[]) => insertReview(...args),
}));

vi.mock("@/lib/analysis/run-analysis", () => ({
  runAnalysis: (...args: unknown[]) => runAnalysis(...args),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: (...args: unknown[]) => getServerEnv(...args),
}));

const auth = {
  user: { id: "owner-1" },
  db: {},
  accessToken: "token",
} as never;

const notePair = {
  previous: {
    note_id: "11111111-1111-4111-8111-111111111111",
    occurred_on: "2026-09-10",
    body: "혼자 식사도 잘하시고 가까운 가게까지 걸어가 장을 볼 수 있음.",
  },
  current: {
    note_id: "22222222-2222-4222-8222-222222222222",
    occurred_on: "2026-10-10",
    body: "최근 다리가 불편해 장을 보기 어렵고 식사를 자주 거르심.",
  },
};

const processingRow = {
  id: "33333333-3333-4333-8333-333333333333",
  case_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  owner_id: "owner-1",
  previous_note_id: notePair.previous.note_id,
  current_note_id: notePair.current.note_id,
  idempotency_key: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  mode: "replay" as const,
  status: "processing" as const,
  schema_version: "1.0",
  model: null,
  result: null,
  failure_code: null,
  created_at: "2026-10-27T08:30:00Z",
  completed_at: null,
};

describe("createOrResumeAnalysis", () => {
  beforeEach(() => {
    vi.resetModules();
    callStartAnalysis.mockReset();
    getAnalysisRowForOwner.mockReset();
    getAnalysisDetail.mockReset();
    getCaseAlias.mockReset();
    getConsultationPair.mockReset();
    listActiveWelfarePrograms.mockReset();
    finalizeAnalysisSuccess.mockReset();
    finalizeAnalysisFailure.mockReset();
    insertReview.mockReset();
    runAnalysis.mockReset();
    getServerEnv.mockReset();
    getServerEnv.mockReturnValue({ ANALYSIS_MODE: "replay" });
  });

  it("returns 200 for existing succeeded idempotent replay (T07)", async () => {
    const { createOrResumeAnalysis } = await import("./service");
    callStartAnalysis.mockResolvedValue({
      created: false,
      analysis_id: processingRow.id,
      status: "succeeded",
    });
    getAnalysisDetail.mockResolvedValue({
      id: processingRow.id,
      status: "succeeded",
      result: { analysis: replayFixture, recommendations: [] },
    });

    const outcome = await createOrResumeAnalysis(
      auth,
      processingRow.case_id,
      processingRow.idempotency_key,
    );
    expect(outcome.httpStatus).toBe(200);
    expect(runAnalysis).not.toHaveBeenCalled();
  });

  it("returns 202 for in-progress same key without re-running AI (T07)", async () => {
    const { createOrResumeAnalysis } = await import("./service");
    callStartAnalysis.mockResolvedValue({
      created: false,
      analysis_id: processingRow.id,
      status: "processing",
    });
    getAnalysisDetail.mockResolvedValue({
      id: processingRow.id,
      status: "processing",
      result: null,
    });

    const outcome = await createOrResumeAnalysis(
      auth,
      processingRow.case_id,
      processingRow.idempotency_key,
    );
    expect(outcome.httpStatus).toBe(202);
    expect(runAnalysis).not.toHaveBeenCalled();
  });

  it("maps prior failure to ANALYSIS_FAILED (T07)", async () => {
    const { createOrResumeAnalysis } = await import("./service");
    callStartAnalysis.mockResolvedValue({
      created: false,
      analysis_id: processingRow.id,
      status: "failed",
    });
    getAnalysisRowForOwner.mockResolvedValue({
      ...processingRow,
      status: "failed",
      failure_code: "REPLAY_UNAVAILABLE",
      completed_at: "2026-10-27T08:31:00Z",
    });

    await expect(
      createOrResumeAnalysis(
        auth,
        processingRow.case_id,
        processingRow.idempotency_key,
      ),
    ).rejects.toMatchObject({
      code: "ANALYSIS_FAILED",
      details: {
        analysis_id: processingRow.id,
        failure_code: "REPLAY_UNAVAILABLE",
      },
    });
  });

  it("runs engine once for new reservation and finalizes success (T05 path)", async () => {
    const { createOrResumeAnalysis } = await import("./service");
    callStartAnalysis.mockResolvedValue({
      created: true,
      analysis_id: processingRow.id,
      status: "processing",
    });
    getAnalysisRowForOwner.mockResolvedValue(processingRow);
    getCaseAlias.mockResolvedValue("합성-001");
    getConsultationPair.mockResolvedValue(notePair);
    listActiveWelfarePrograms.mockResolvedValue(DEMO_WELFARE_PROGRAMS);
    runAnalysis.mockResolvedValue({
      mode: "replay",
      model: null,
      analysis: replayFixture,
      recommendations: [{ program_id: "daegu_integrated" }],
      recommendations_message: "식사·거동 변화와 관련된 사업 후보",
    });
    finalizeAnalysisSuccess.mockResolvedValue(true);
    getAnalysisDetail.mockResolvedValue({
      id: processingRow.id,
      status: "succeeded",
      mode: "replay",
      result: {
        analysis: replayFixture,
        recommendations: [{ program_id: "daegu_integrated" }],
      },
    });

    const outcome = await createOrResumeAnalysis(
      auth,
      processingRow.case_id,
      processingRow.idempotency_key,
    );

    expect(outcome.httpStatus).toBe(201);
    expect(runAnalysis).toHaveBeenCalledTimes(1);
    expect(listActiveWelfarePrograms).toHaveBeenCalled();
    expect(finalizeAnalysisSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisId: processingRow.id,
        ownerId: "owner-1",
        caseId: processingRow.case_id,
        model: null,
      }),
    );
  });

  it("persists failure and does not fall back to silent replay (T16)", async () => {
    const { createOrResumeAnalysis } = await import("./service");
    callStartAnalysis.mockResolvedValue({
      created: true,
      analysis_id: processingRow.id,
      status: "processing",
    });
    getAnalysisRowForOwner.mockResolvedValue(processingRow);
    getCaseAlias.mockResolvedValue("합성-001");
    getConsultationPair.mockResolvedValue(notePair);
    listActiveWelfarePrograms.mockResolvedValue(DEMO_WELFARE_PROGRAMS);
    runAnalysis.mockRejectedValue(new ApiError("REPLAY_UNAVAILABLE"));
    finalizeAnalysisFailure.mockResolvedValue(true);

    await expect(
      createOrResumeAnalysis(
        auth,
        processingRow.case_id,
        processingRow.idempotency_key,
      ),
    ).rejects.toMatchObject({
      code: "REPLAY_UNAVAILABLE",
      details: { analysis_id: processingRow.id },
    });
    expect(finalizeAnalysisFailure).toHaveBeenCalledWith({
      analysisId: processingRow.id,
      ownerId: "owner-1",
      caseId: processingRow.case_id,
      failureCode: "REPLAY_UNAVAILABLE",
    });
  });

  it("persists failure when post-reservation prep lookup fails", async () => {
    const { createOrResumeAnalysis } = await import("./service");
    callStartAnalysis.mockResolvedValue({
      created: true,
      analysis_id: processingRow.id,
      status: "processing",
    });
    getAnalysisRowForOwner.mockResolvedValue(processingRow);
    getCaseAlias.mockResolvedValue("합성-001");
    getConsultationPair.mockRejectedValue(new Error("db_read_failed"));
    listActiveWelfarePrograms.mockResolvedValue(DEMO_WELFARE_PROGRAMS);
    finalizeAnalysisFailure.mockResolvedValue(true);

    await expect(
      createOrResumeAnalysis(
        auth,
        processingRow.case_id,
        processingRow.idempotency_key,
      ),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      details: { analysis_id: processingRow.id },
    });
    expect(runAnalysis).not.toHaveBeenCalled();
    expect(finalizeAnalysisFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisId: processingRow.id,
        failureCode: "SERVICE_UNAVAILABLE",
      }),
    );
  });

  it("returns SERVICE_UNAVAILABLE with recovery when failure cannot be persisted", async () => {
    const { createOrResumeAnalysis } = await import("./service");
    callStartAnalysis.mockResolvedValue({
      created: true,
      analysis_id: processingRow.id,
      status: "processing",
    });
    getAnalysisRowForOwner.mockResolvedValue(processingRow);
    getCaseAlias.mockResolvedValue("합성-001");
    getConsultationPair.mockResolvedValue(notePair);
    listActiveWelfarePrograms.mockResolvedValue(DEMO_WELFARE_PROGRAMS);
    runAnalysis.mockRejectedValue(new ApiError("AI_UNAVAILABLE"));
    finalizeAnalysisFailure.mockRejectedValue(new Error("db_down"));

    await expect(
      createOrResumeAnalysis(
        auth,
        processingRow.case_id,
        processingRow.idempotency_key,
      ),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      details: {
        analysis_id: processingRow.id,
        recovery: "failure_persist_unavailable",
      },
    });
  });

  it("enforces overall 45s deadline and marks TIMEOUT", async () => {
    vi.useFakeTimers();
    try {
      const { createOrResumeAnalysis, ANALYSIS_OVERALL_TIMEOUT_MS } =
        await import("./service");
      callStartAnalysis.mockResolvedValue({
        created: true,
        analysis_id: processingRow.id,
        status: "processing",
      });
      getAnalysisRowForOwner.mockResolvedValue(processingRow);
      getCaseAlias.mockImplementation(
        () => new Promise(() => undefined),
      );
      getConsultationPair.mockResolvedValue(notePair);
      listActiveWelfarePrograms.mockResolvedValue(DEMO_WELFARE_PROGRAMS);
      finalizeAnalysisFailure.mockResolvedValue(true);

      const pending = createOrResumeAnalysis(
        auth,
        processingRow.case_id,
        processingRow.idempotency_key,
      );
      const expectation = expect(pending).rejects.toMatchObject({
        code: "TIMEOUT",
        details: { analysis_id: processingRow.id },
      });
      await vi.advanceTimersByTimeAsync(ANALYSIS_OVERALL_TIMEOUT_MS + 10);
      await expectation;
      expect(finalizeAnalysisFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisId: processingRow.id,
          failureCode: "TIMEOUT",
        }),
      );
      expect(runAnalysis).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks SERVICE_UNAVAILABLE when success persist throws", async () => {
    const { createOrResumeAnalysis } = await import("./service");
    callStartAnalysis.mockResolvedValue({
      created: true,
      analysis_id: processingRow.id,
      status: "processing",
    });
    getAnalysisRowForOwner.mockResolvedValue(processingRow);
    getCaseAlias.mockResolvedValue("합성-001");
    getConsultationPair.mockResolvedValue(notePair);
    listActiveWelfarePrograms.mockResolvedValue(DEMO_WELFARE_PROGRAMS);
    runAnalysis.mockResolvedValue({
      mode: "replay",
      model: null,
      analysis: replayFixture,
      recommendations: [],
      recommendations_message: "확인할 사업 후보가 없습니다. 원문을 검토해 주세요.",
    });
    finalizeAnalysisSuccess.mockRejectedValue(new Error("db_write_failed"));
    finalizeAnalysisFailure.mockResolvedValue(true);

    await expect(
      createOrResumeAnalysis(
        auth,
        processingRow.case_id,
        processingRow.idempotency_key,
      ),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      details: {
        analysis_id: processingRow.id,
        reason: "success_persist_failed",
      },
    });
    expect(finalizeAnalysisFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisId: processingRow.id,
        failureCode: "SERVICE_UNAVAILABLE",
      }),
    );
  });

  it("discards late success when processing row already terminal (T24)", async () => {
    const { createOrResumeAnalysis } = await import("./service");
    callStartAnalysis.mockResolvedValue({
      created: true,
      analysis_id: processingRow.id,
      status: "processing",
    });
    getAnalysisRowForOwner.mockResolvedValue(processingRow);
    getCaseAlias.mockResolvedValue("합성-001");
    getConsultationPair.mockResolvedValue(notePair);
    listActiveWelfarePrograms.mockResolvedValue(DEMO_WELFARE_PROGRAMS);
    runAnalysis.mockResolvedValue({
      mode: "replay",
      model: null,
      analysis: replayFixture,
      recommendations: [],
      recommendations_message: "확인할 사업 후보가 없습니다. 원문을 검토해 주세요.",
    });
    finalizeAnalysisSuccess.mockResolvedValue(false);
    getAnalysisDetail.mockResolvedValue({
      id: processingRow.id,
      status: "failed",
      failure_code: "TIMEOUT",
    });

    await expect(
      createOrResumeAnalysis(
        auth,
        processingRow.case_id,
        processingRow.idempotency_key,
      ),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

describe("createAnalysisReview (T14, T26)", () => {
  beforeEach(() => {
    vi.resetModules();
    getAnalysisRowForOwner.mockReset();
    getAnalysisDetail.mockReset();
    insertReview.mockReset();
  });

  it("rejects processing and failed analyses", async () => {
    const { createAnalysisReview } = await import("./service");
    getAnalysisRowForOwner.mockResolvedValueOnce({
      ...processingRow,
      status: "processing",
    });
    await expect(
      createAnalysisReview(auth, processingRow.id, "confirmed", ""),
    ).rejects.toMatchObject({ code: "ANALYSIS_IN_PROGRESS" });

    getAnalysisRowForOwner.mockResolvedValueOnce({
      ...processingRow,
      status: "failed",
      failure_code: "AI_UNAVAILABLE",
    });
    await expect(
      createAnalysisReview(auth, processingRow.id, "confirmed", ""),
    ).rejects.toMatchObject({ code: "ANALYSIS_FAILED" });
  });

  it("inserts one review for succeeded analysis", async () => {
    const { createAnalysisReview } = await import("./service");
    getAnalysisRowForOwner.mockResolvedValue({
      ...processingRow,
      status: "succeeded",
      result: { analysis: replayFixture, recommendations: [] },
      completed_at: "2026-10-27T08:30:01Z",
    });
    getAnalysisDetail.mockResolvedValue({
      id: processingRow.id,
      status: "succeeded",
      review: null,
    });
    insertReview.mockResolvedValue({
      id: "r1",
      analysis_id: processingRow.id,
      decision: "needs_followup",
      note: "확인 예정",
      created_at: "2026-10-27T09:00:00Z",
    });

    const review = await createAnalysisReview(
      auth,
      processingRow.id,
      "needs_followup",
      "확인 예정",
    );
    expect(review.decision).toBe("needs_followup");
    expect(insertReview).toHaveBeenCalled();
  });
});
