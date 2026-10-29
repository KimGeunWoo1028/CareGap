import { beforeEach, describe, expect, it, vi } from "vitest";

const listFollowUpTasks = vi.fn();
const insertFollowUpTask = vi.fn();
const updateFollowUpTaskStatus = vi.fn();
const findOpenFollowUpForAnalysis = vi.fn();

vi.mock("@/lib/follow-ups/repository", () => ({
  listFollowUpTasks: (...args: unknown[]) => listFollowUpTasks(...args),
  insertFollowUpTask: (...args: unknown[]) => insertFollowUpTask(...args),
  updateFollowUpTaskStatus: (...args: unknown[]) =>
    updateFollowUpTaskStatus(...args),
  findOpenFollowUpForAnalysis: (...args: unknown[]) =>
    findOpenFollowUpForAnalysis(...args),
}));

const auth = {
  user: { id: "owner-1" },
  db: {},
  accessToken: "token",
} as never;

describe("follow-up service", () => {
  beforeEach(() => {
    vi.resetModules();
    listFollowUpTasks.mockReset();
    insertFollowUpTask.mockReset();
    updateFollowUpTaskStatus.mockReset();
    findOpenFollowUpForAnalysis.mockReset();
  });

  it("creates next_consultation from needs_followup review", async () => {
    const { createFollowUpFromReview } = await import("./service");
    findOpenFollowUpForAnalysis.mockResolvedValue(null);
    insertFollowUpTask.mockResolvedValue({
      id: "task-1",
      kind: "next_consultation",
      status: "open",
    });
    await createFollowUpFromReview(auth, {
      caseId: "case-1",
      analysisId: "analysis-1",
      reviewNote: "다음 주 방문",
    });
    expect(insertFollowUpTask).toHaveBeenCalledWith(
      auth.db,
      expect.objectContaining({
        ownerId: "owner-1",
        caseId: "case-1",
        analysisId: "analysis-1",
        kind: "next_consultation",
        note: "다음 주 방문",
      }),
    );
  });

  it("reuses existing open follow-up for the same analysis (idempotent)", async () => {
    const { createFollowUpFromReview } = await import("./service");
    findOpenFollowUpForAnalysis.mockResolvedValue({
      id: "task-existing",
      kind: "next_consultation",
      status: "open",
    });
    const task = await createFollowUpFromReview(auth, {
      caseId: "case-1",
      analysisId: "analysis-1",
      reviewNote: "다시",
    });
    expect(task.id).toBe("task-existing");
    expect(insertFollowUpTask).not.toHaveBeenCalled();
  });

  it("rejects manual create when open task already exists for analysis+kind", async () => {
    const { createFollowUpTask } = await import("./service");
    findOpenFollowUpForAnalysis.mockResolvedValue({ id: "task-1" });
    await expect(
      createFollowUpTask(auth, {
        caseId: "case-1",
        analysisId: "analysis-1",
        kind: "next_consultation",
        note: "dup",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: { reason: "follow_up_open_exists" },
    });
    expect(insertFollowUpTask).not.toHaveBeenCalled();
  });

  it("completes open tasks only via terminal status", async () => {
    const { completeFollowUpTask } = await import("./service");
    updateFollowUpTaskStatus.mockResolvedValue({
      id: "task-1",
      status: "done",
    });
    await completeFollowUpTask(auth, "task-1", "done");
    expect(updateFollowUpTaskStatus).toHaveBeenCalledWith(
      auth.db,
      "task-1",
      "done",
    );
  });

  it("cancels open tasks via terminal status", async () => {
    const { completeFollowUpTask } = await import("./service");
    updateFollowUpTaskStatus.mockResolvedValue({
      id: "task-1",
      status: "cancelled",
    });
    await completeFollowUpTask(auth, "task-1", "cancelled");
    expect(updateFollowUpTaskStatus).toHaveBeenCalledWith(
      auth.db,
      "task-1",
      "cancelled",
    );
  });
});
