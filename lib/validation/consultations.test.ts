import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  codePointLength,
  parseCreateConsultationBody,
  seoulTodayIsoDate,
} from "@/lib/validation/consultations";

describe("consultation validation (T03/T04/T25)", () => {
  const today = seoulTodayIsoDate();

  it("accepts valid past and today records and preserves body whitespace", () => {
    const body = "  최근 식사를 자주 거르심.  ";
    const parsed = parseCreateConsultationBody({
      occurred_on: today,
      channel: "phone",
      body,
    });
    expect(parsed.body).toBe(body);
    expect(parsed.channel).toBe("phone");
  });

  it("rejects blank-only body", () => {
    expect(() =>
      parseCreateConsultationBody({
        occurred_on: today,
        channel: "visit",
        body: "   \n\t  ",
      }),
    ).toThrow(ApiError);
  });

  it("rejects body over 2000 code points", () => {
    const body = "한".repeat(2001);
    expect(codePointLength(body)).toBe(2001);
    expect(() =>
      parseCreateConsultationBody({
        occurred_on: today,
        channel: "other",
        body,
      }),
    ).toThrow(ApiError);
  });

  it("rejects future Seoul dates", () => {
    expect(() =>
      parseCreateConsultationBody({
        occurred_on: "2099-01-01",
        channel: "phone",
        body: "미래 날짜 테스트 합성 원문",
      }),
    ).toThrow(ApiError);
  });

  it("rejects invalid calendar dates", () => {
    expect(() =>
      parseCreateConsultationBody({
        occurred_on: "2026-02-30",
        channel: "phone",
        body: "잘못된 달력 날짜",
      }),
    ).toThrow(ApiError);
  });

  it("rejects unknown channels and extra JSON fields", () => {
    expect(() =>
      parseCreateConsultationBody({
        occurred_on: today,
        channel: "fax",
        body: "채널 오류",
      }),
    ).toThrow(ApiError);

    expect(() =>
      parseCreateConsultationBody({
        occurred_on: today,
        channel: "phone",
        body: "추가 필드",
        owner_id: "should-not-be-accepted",
      }),
    ).toThrow(ApiError);
  });

  it("rejects suspicious email, phone, and RRN patterns", () => {
    const samples = [
      "연락처는 demo@example.com 입니다",
      "전화 010-1234-5678 로 연락",
      "주민번호 형태 900101-1234567 언급",
    ];
    for (const body of samples) {
      expect(() =>
        parseCreateConsultationBody({
          occurred_on: today,
          channel: "phone",
          body,
        }),
      ).toThrow(ApiError);
    }
  });

  it("counts unicode code points including emoji", () => {
    expect(codePointLength("가나다")).toBe(3);
    expect(codePointLength("🙂🙂")).toBe(2);
  });
});
