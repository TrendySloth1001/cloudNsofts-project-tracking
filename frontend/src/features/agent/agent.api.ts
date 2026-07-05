import {
  apiPaths,
  type ApiTokenSummary,
  type CreateApiTokenInput,
  type CreatedApiToken,
} from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/** Personal Access Tokens for connecting coding agents (paths from shared). */
export const agentApi = {
  list: () =>
    apiClient.get<{ tokens: ApiTokenSummary[] }>(apiPaths.auth.tokens()),
  create: (input: CreateApiTokenInput) =>
    apiClient.post<CreatedApiToken>(apiPaths.auth.tokens(), input),
  revoke: (id: string) => apiClient.delete<void>(apiPaths.auth.token(id)),
};
