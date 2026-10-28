import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("review/follow-up atomicity SQL contract (005)", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "sql/005_review_follow_up_atomicity.sql"),
    "utf8",
  );

  it("uses AFTER INSERT trigger on reviews with SECURITY INVOKER", () => {
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/after insert on public\.reviews/i);
    expect(sql).toMatch(/reviews_enqueue_follow_up/);
  });

  it("only auto-creates follow-up for needs_followup", () => {
    expect(sql).toMatch(/needs_followup/);
    expect(sql).toMatch(/next_consultation/);
  });

  it("does not grant execute of trigger function to anon/authenticated", () => {
    expect(sql).toMatch(/revoke all on function public\.reviews_enqueue_follow_up/i);
  });
});
