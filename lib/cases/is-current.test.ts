import { describe, expect, it } from "vitest";
import { computeIsCurrent } from "@/lib/cases/is-current";

describe("computeIsCurrent", () => {
  it("returns false when fewer than two notes exist", () => {
    expect(
      computeIsCurrent(["n1"], {
        previous_note_id: "n1",
        current_note_id: "n2",
      }),
    ).toBe(false);
  });

  it("returns true when analysis note pair matches latest two ids", () => {
    expect(
      computeIsCurrent(["n2", "n1", "n0"], {
        previous_note_id: "n1",
        current_note_id: "n2",
      }),
    ).toBe(true);
  });

  it("returns false when analysis points at older notes", () => {
    expect(
      computeIsCurrent(["n3", "n2", "n1"], {
        previous_note_id: "n1",
        current_note_id: "n2",
      }),
    ).toBe(false);
  });
});
