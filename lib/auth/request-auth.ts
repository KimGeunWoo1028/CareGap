import type { User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import {
  createAuthVerificationClient,
  createUserScopedClient,
  type UserScopedClient,
} from "@/lib/db/clients";

export type AuthenticatedRequest = {
  accessToken: string;
  user: User;
  db: UserScopedClient;
};

export function extractBearerToken(
  authorizationHeader: string | null,
): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match) return null;
  const token = match[1]?.trim();
  return token ? token : null;
}

export async function requireAuthenticatedRequest(
  request: Request,
): Promise<AuthenticatedRequest> {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    throw new ApiError("UNAUTHENTICATED");
  }

  const authClient = createAuthVerificationClient();
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError("UNAUTHENTICATED");
  }

  return {
    accessToken: token,
    user: data.user,
    db: createUserScopedClient(token),
  };
}
