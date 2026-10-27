import { requireAuthenticatedRequest } from "@/lib/auth/request-auth";
import { createCase, listCases } from "@/lib/cases/repository";
import {
  createRequestId,
  jsonCreated,
  jsonFromUnknownError,
  jsonOk,
} from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/read-json";
import { parseCreateCaseBody } from "@/lib/validation/cases";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId();
  try {
    const auth = await requireAuthenticatedRequest(request);
    const cases = await listCases(auth.db);
    return jsonOk(cases, { requestId });
  } catch (error) {
    return jsonFromUnknownError(error, requestId);
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  try {
    const auth = await requireAuthenticatedRequest(request);
    const body = parseCreateCaseBody(await readJsonBody(request));
    const created = await createCase(auth.db, auth.user.id, body.alias);
    return jsonCreated(created, requestId);
  } catch (error) {
    return jsonFromUnknownError(error, requestId);
  }
}
