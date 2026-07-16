import {
  apiPaths,
  type AuthUser,
  type LoginInput,
  type SignupInput,
  type UpdateProfileInput,
  type UserProfile,
} from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/**
 * Auth data-access. The session lives in httpOnly cookies the server sets on
 * login/signup (and rotates on refresh), so there's no token to store client
 * side — the browser carries it automatically. Paths come from the shared
 * single source of truth.
 */
export const authApi = {
  login: (input: LoginInput) =>
    apiClient.post<{ user: AuthUser }>(apiPaths.auth.login(), input),

  signup: (input: SignupInput) =>
    apiClient.post<{ user: AuthUser }>(apiPaths.auth.signup(), input),

  me: () => apiClient.get<{ user: UserProfile }>(apiPaths.auth.me()),

  updateProfile: (input: UpdateProfileInput) =>
    apiClient.patch<{ user: UserProfile }>(apiPaths.auth.me(), input),

  /** Revoke the current session server-side and clear its cookies. */
  logout: () => apiClient.post<void>(apiPaths.auth.logout(), {}),
};
