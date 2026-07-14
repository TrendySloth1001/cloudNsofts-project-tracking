import {
  apiPaths,
  type AgentActivity,
  type ApiTokenSummary,
  type AuthUser,
  type CreateApiTokenInput,
  type CreatedApiToken,
  type TokenVerifyResult,
  type UpdateApiTokenInput,
} from '@cnsofts/shared';
import { apiClient, ApiRequestError } from '@/lib/api-client';
import { config } from '@/lib/config';

/** Personal Access Tokens for connecting coding agents (paths from shared). */
export const agentApi = {
  list: () =>
    apiClient.get<{ tokens: ApiTokenSummary[] }>(apiPaths.auth.tokens()),
  create: (input: CreateApiTokenInput) =>
    apiClient.post<CreatedApiToken>(apiPaths.auth.tokens(), input),
  rename: (id: string, input: UpdateApiTokenInput) =>
    apiClient.patch<ApiTokenSummary>(apiPaths.auth.token(id), input),
  rotate: (id: string) =>
    apiClient.post<CreatedApiToken>(apiPaths.auth.tokenRotate(id), {}),
  revoke: (id: string) => apiClient.delete<void>(apiPaths.auth.token(id)),
  /** Check whether a stored token still works, from its DB record (by id) — no
   *  raw key needed. */
  verifyById: (id: string) =>
    apiClient.post<TokenVerifyResult>(apiPaths.auth.tokenVerify(id), {}),
  activity: () =>
    apiClient.get<{ activity: AgentActivity[] }>(apiPaths.auth.agentActivity()),

  /**
   * Verify a Personal Access Token by calling `/me` AS that token — proves the
   * token authenticates and reveals the principal it acts as. Uses a raw fetch
   * (not `apiClient`, which sends the logged-in user's session JWT).
   */
  verify: async (token: string): Promise<AuthUser> => {
    const res = await fetch(`${config.apiUrl}${apiPaths.auth.me()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      // Prefer the backend's precise reason (revoked / expired / deleted), which
      // it returns in the standard ApiError envelope; fall back to a generic.
      let message =
        res.status === 401
          ? 'Token was rejected — it may be revoked or expired.'
          : 'Could not verify the token.';
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body.error?.message) message = body.error.message;
      } catch {
        /* keep the fallback message */
      }
      throw new ApiRequestError(res.status, message);
    }
    const body = (await res.json()) as { user: AuthUser };
    return body.user;
  },
};
