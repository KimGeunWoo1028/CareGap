import { requireAuthenticatedRequest } from "@/lib/auth/request-auth";
import {
  createRequestId,
  jsonCreated,
  jsonFromUnknownError,
  jsonOk,
} from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/read-json";
import {
  createFollowUpTask,
  listOwnerFollowUps,
} from "@/lib/follow-ups/service";
import {
  parseCreateFollowUpBody,
  parseFollowUpListQuery,
} from "@/lib/validation/follow-ups";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId();
  try {
    const auth = await requireAuthenticatedRequest(request);
    const { status } = parseFollowUpListQuery(new URL(request.url));
    const tasks = await listOwnerFollowUps(auth, status);
    return jsonOk(tasks, { requestId });
  } catch (error) {
    return jsonFromUnknownError(error, requestId);
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  try {
    const auth = await requireAuthenticatedRequest(request);
    const body = parseCreateFollowUpBody(await readJsonBody(request));
    const created = await createFollowUpTask(auth, {
      caseId: body.case_id,
      analysisId: body.analysis_id,
      kind: body.kind,
      note: body.note,
      dueOn: body.due_on,
    });
    return jsonCreated(created, requestId);
  } catch (error) {
    return jsonFromUnknownError(error, requestId);
  }
}
