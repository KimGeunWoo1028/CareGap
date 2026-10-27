import { ApiError } from "@/lib/api/errors";

export const MAX_REQUEST_BYTES = 16 * 1024;

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > MAX_REQUEST_BYTES) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "요청 본문이 너무 큽니다. 16 KiB 이내로 보내 주세요.",
      );
    }
  }

  const raw = await request.text();
  const byteLength = new TextEncoder().encode(raw).byteLength;
  if (byteLength > MAX_REQUEST_BYTES) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "요청 본문이 너무 큽니다. 16 KiB 이내로 보내 주세요.",
    );
  }

  if (raw.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "JSON 본문이 필요합니다.");
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError("VALIDATION_ERROR", "올바른 JSON이 필요합니다.");
  }
}
