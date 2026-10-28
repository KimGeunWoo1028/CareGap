import { requireAuthenticatedRequest } from "@/lib/auth/request-auth";
import {
  createRequestId,
  jsonFromUnknownError,
  jsonOk,
} from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/read-json";
import { completeFollowUpTask } from "@/lib/follow-ups/service";
import { parseUpdateFollowUpBody } from "@/lib/validation/follow-ups";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ task_id: string }> };

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = createRequestId();
  try {
    const auth = await requireAuthenticatedRequest(request);
    const { task_id } = await context.params;
    const body = parseUpdateFollowUpBody(await readJsonBody(request));
    const updated = await completeFollowUpTask(auth, task_id, body.status);
    return jsonOk(updated, { requestId });
  } catch (error) {
    return jsonFromUnknownError(error, requestId);
  }
}
