import { describe, expect, it } from "vitest";
import {
  DEMO_ALIAS,
  assertCreateBatchReady,
  planGateCases,
  preferredAliases,
} from "./real-db-follow-up-gate-plan.mjs";

describe("planGateCases", () => {
  it("prefers 090-099 and never includes demo alias", () => {
    const aliases = preferredAliases();
    expect(aliases[0]).toBe("합성-090");
    expect(aliases.at(-1)).toBe("합성-099");
    expect(aliases).not.toContain(DEMO_ALIAS);
  });

  it("resumes reported cases that still exist instead of creating again", () => {
    const plan = planGateCases({
      existingAliases: ["합성-093", "합성-094", "합성-097"],
      resumeCases: [
        { id: "id-093", alias: "합성-093" },
        { id: "id-094", alias: "합성-094" },
      ],
      max: 2,
    });
    expect(plan.reuse).toEqual([
      { id: "id-093", alias: "합성-093" },
      { id: "id-094", alias: "합성-094" },
    ]);
    expect(plan.toCreate).toEqual([]);
  });

  it("preflights two free aliases and skips occupied ones including orphans", () => {
    const plan = planGateCases({
      existingAliases: ["합성-097", "합성-098"],
      resumeCases: [],
      max: 2,
    });
    expect(plan.toCreate).toEqual(["합성-090", "합성-091"]);
    expect(plan.blocked).toEqual(
      expect.arrayContaining(["합성-097", "합성-098"]),
    );
  });

  it("refuses a partial create batch when not enough free aliases", () => {
    const plan = planGateCases({
      preferred: ["합성-090"],
      existingAliases: ["합성-090"],
      max: 2,
    });
    expect(plan.toCreate).toEqual([]);
    expect(() =>
      assertCreateBatchReady({ toCreate: plan.toCreate, need: 2 }),
    ).toThrow(/insufficient free aliases/);
  });

  it("never schedules demo alias for create", () => {
    const plan = planGateCases({
      preferred: [DEMO_ALIAS, "합성-090", "합성-091"],
      existingAliases: [],
      max: 2,
    });
    expect(plan.toCreate).toEqual(["합성-090", "합성-091"]);
    expect(plan.blocked).toContain(DEMO_ALIAS);
  });
});
