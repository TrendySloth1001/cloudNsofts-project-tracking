import {
  apiPaths,
  type ApiTokenSummary,
  type AuthUser,
  type CreateApiTokenInput,
  type CreatedApiToken,
} from '@cnsofts/shared';
import { apiClient, ApiRequestError } from '@/lib/api-client';
import { config } from '@/lib/config';

/** Personal Access Tokens for connecting coding agents (paths from shared). */
export const agentApi = {
  list: () =>
    apiClient.get<{ tokens: ApiTokenSummary[] }>(apiPaths.auth.tokens()),
  create: (input: CreateApiTokenInput) =>
    apiClient.post<CreatedApiToken>(apiPaths.auth.tokens(), input),
  revoke: (id: string) => apiClient.delete<void>(apiPaths.auth.token(id)),

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
      throw new ApiRequestError(
        res.status,
        res.status === 401
          ? 'Token was rejected — it may be revoked or expired.'
          : 'Could not verify the token.',
      );
    }
    const body = (await res.json()) as { user: AuthUser };
    return body.user;
  },
};
