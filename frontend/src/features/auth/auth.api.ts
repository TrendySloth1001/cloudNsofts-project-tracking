import {
  apiPaths,
  type AuthResponse,
  type LoginInput,
  type SignupInput,
  type UpdateProfileInput,
  type UserProfile,
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

  async signup(input: SignupInput): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>(
      apiPaths.auth.signup(),
      input,
    );
    authStorage.set(result.token);
    return result;
  },

  me: () => apiClient.get<{ user: UserProfile }>(apiPaths.auth.me()),

  updateProfile: (input: UpdateProfileInput) =>
    apiClient.patch<{ user: UserProfile }>(apiPaths.auth.me(), input),

  logout: () => authStorage.clear(),

  isAuthenticated: () => authStorage.get() !== null,
};
