import { describe, expect, it } from "vitest";
import { mapDatabaseError } from "@/lib/api/errors";

describe("database error mapping", () => {
  it("maps unique alias constraint to DUPLICATE_ALIAS", () => {
    const error = mapDatabaseError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "cases_owner_id_alias_key"',
    });
    expect(error.code).toBe("DUPLICATE_ALIAS");
    expect(error.status).toBe(409);
  });

  it("maps unique consultation date constraint to DUPLICATE_DATE", () => {
    const error = mapDatabaseError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "consultations_case_id_occurred_on_key"',
    });
    expect(error.code).toBe("DUPLICATE_DATE");
    expect(error.status).toBe(409);
  });

  it("maps unknown DB failures to SERVICE_UNAVAILABLE without leaking SQL", () => {
    const error = mapDatabaseError({
      code: "XX000",
      message: "permission denied for table secret_stuff",
    });
    expect(error.code).toBe("SERVICE_UNAVAILABLE");
    expect(error.message).not.toMatch(/permission denied|secret_stuff/i);
  });
});
