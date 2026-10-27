import { requireAuthenticatedRequest } from "@/lib/auth/request-auth";
import { getAnalysisDetail } from "@/lib/analysis/repository";
import {
  createRequestId,
  jsonFromUnknownError,
  jsonOk,
} from "@/lib/api/response";
import { assertUuidParam } from "@/lib/validation/analyses";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ analysis_id: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = createRequestId();
  try {
    const auth = await requireAuthenticatedRequest(request);
    const { analysis_id } = await context.params;
    const detail = await getAnalysisDetail(
      auth.db,
      assertUuidParam(analysis_id),
    );
    return jsonOk(detail, { requestId });
  } catch (error) {
    return jsonFromUnknownError(error, requestId);
  }
}
