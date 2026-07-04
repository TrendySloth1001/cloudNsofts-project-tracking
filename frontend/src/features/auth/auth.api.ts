import {
  apiPaths,
  type AuthResponse,
  type AuthUser,
  type LoginInput,
} from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';
import { authStorage } from '@/lib/auth-storage';

/** Auth data-access. Paths come from the shared single source of truth. */
export const authApi = {
  async login(input: LoginInput): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>(
      apiPaths.auth.login(),
      input,
    );
    authStorage.set(result.token);
    return result;
  },

  me: () => apiClient.get<{ user: AuthUser }>(apiPaths.auth.me()),

  logout: () => authStorage.clear(),

  isAuthenticated: () => authStorage.get() !== null,
};
