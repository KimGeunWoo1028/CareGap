import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const select = vi.fn(() => ({ maybeSingle }));
const eqStatus = vi.fn(() => ({ select }));
const eqId = vi.fn(() => ({ eq: eqStatus }));
const update = vi.fn(() => ({ eq: eqId }));
const from = vi.fn(() => ({ update }));

vi.mock("@/lib/db/clients", () => ({}));

describe("updateFollowUpTaskStatus payload", () => {
  beforeEach(() => {
    vi.resetModules();
    maybeSingle.mockReset();
    select.mockClear();
    eqStatus.mockClear();
    eqId.mockClear();
    update.mockClear();
    from.mockClear();
    maybeSingle.mockResolvedValue({
      data: {
        id: "task-1",
        status: "done",
        completed_at: "2026-10-28T00:00:00Z",
      },
      error: null,
    });
  });

  it("updates only status and completed_at (never ownership/FK columns)", async () => {
    const { updateFollowUpTaskStatus } = await import("./repository");
    const db = { from } as never;
    await updateFollowUpTaskStatus(db, "task-1", "done");
    expect(from).toHaveBeenCalledWith("follow_up_tasks");
    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["completed_at", "status"]);
    expect(payload.status).toBe("done");
    expect(typeof payload.completed_at).toBe("string");
    expect(payload).not.toHaveProperty("owner_id");
    expect(payload).not.toHaveProperty("case_id");
    expect(payload).not.toHaveProperty("analysis_id");
    expect(payload).not.toHaveProperty("kind");
  });
});
