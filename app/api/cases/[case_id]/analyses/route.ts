import { requireAuthenticatedRequest } from "@/lib/auth/request-auth";
import { createOrResumeAnalysis } from "@/lib/analysis/service";
import {
  createRequestId,
  jsonAccepted,
  jsonCreated,
  jsonFromUnknownError,
  jsonOk,
} from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/read-json";
import {
  assertUuidParam,
  parseEmptyAnalysisBody,
  parseIdempotencyKey,
} from "@/lib/validation/analyses";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ case_id: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = createRequestId();
  try {
    const auth = await requireAuthenticatedRequest(request);
    const { case_id } = await context.params;
    const caseId = assertUuidParam(case_id);
    const idempotencyKey = parseIdempotencyKey(
      request.headers.get("idempotency-key"),
    );
    parseEmptyAnalysisBody(await readJsonBody(request));

    const outcome = await createOrResumeAnalysis(
      auth,
      caseId,
      idempotencyKey,
    );

    if (outcome.httpStatus === 201) {
      return jsonCreated(outcome.detail, requestId);
    }
    if (outcome.httpStatus === 202) {
      return jsonAccepted(outcome.detail, requestId);
    }
    return jsonOk(outcome.detail, { status: 200, requestId });
  } catch (error) {
    return jsonFromUnknownError(error, requestId);
  }
}
