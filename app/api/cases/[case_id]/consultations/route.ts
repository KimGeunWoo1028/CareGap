import { requireAuthenticatedRequest } from "@/lib/auth/request-auth";
import { createConsultation } from "@/lib/cases/repository";
import { ApiError } from "@/lib/api/errors";
import {
  createRequestId,
  jsonCreated,
  jsonFromUnknownError,
} from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/read-json";
import { parseCreateConsultationBody } from "@/lib/validation/consultations";

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

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = createRequestId();
  try {
    const auth = await requireAuthenticatedRequest(request);
    const { case_id } = await context.params;
    const body = parseCreateConsultationBody(await readJsonBody(request));
    // Preserve leading/trailing whitespace exactly as submitted.
    const created = await createConsultation(auth.db, assertCaseId(case_id), {
      occurred_on: body.occurred_on,
      channel: body.channel,
      body: body.body,
    });
    return jsonCreated(created, requestId);
  } catch (error) {
    return jsonFromUnknownError(error, requestId);
  }
}
