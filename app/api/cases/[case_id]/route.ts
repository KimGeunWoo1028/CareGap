import { requireAuthenticatedRequest } from "@/lib/auth/request-auth";
import { getCaseDetail } from "@/lib/cases/repository";
import { ApiError } from "@/lib/api/errors";
import {
  createRequestId,
  jsonFromUnknownError,
  jsonOk,
} from "@/lib/api/response";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ case_id: string }>;
};

function assertCaseId(caseId: string | undefined): string {
  if (!caseId || !/^[0-9a-f-]{36}$/i.test(caseId)) {
    throw new ApiError("NOT_FOUND");
  }
  return caseId;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = createRequestId();
  try {
    const auth = await requireAuthenticatedRequest(request);
    const { case_id } = await context.params;
    const detail = await getCaseDetail(auth.db, assertCaseId(case_id));
    return jsonOk(detail, { requestId });
  } catch (error) {
    return jsonFromUnknownError(error, requestId);
  }
}
