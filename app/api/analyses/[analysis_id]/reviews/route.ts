import { requireAuthenticatedRequest } from "@/lib/auth/request-auth";
import { createAnalysisReview } from "@/lib/analysis/service";
import {
  createRequestId,
  jsonCreated,
  jsonFromUnknownError,
} from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/read-json";
import { assertUuidParam } from "@/lib/validation/analyses";
import { parseCreateReviewBody } from "@/lib/validation/reviews";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ analysis_id: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = createRequestId();
  try {
    const auth = await requireAuthenticatedRequest(request);
    const { analysis_id } = await context.params;
    const body = parseCreateReviewBody(await readJsonBody(request));
    const created = await createAnalysisReview(
      auth,
      assertUuidParam(analysis_id),
      body.decision,
      body.note,
    );
    return jsonCreated(created, requestId);
  } catch (error) {
    return jsonFromUnknownError(error, requestId);
  }
}
