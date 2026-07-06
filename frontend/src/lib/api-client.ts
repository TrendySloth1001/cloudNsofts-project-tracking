import type { ApiError } from '@cnsofts/shared';
import { config } from './config';
import { authStorage } from './auth-storage';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Pull the first field-level validation message (e.g. `body`) out of a failed
 * request's `details`, so the UI can show the real reason instead of the
 * generic "Validation failed".
 */
export function fieldErrorMessage(err: unknown, field: string): string | null {
  if (
    err instanceof ApiRequestError &&
    err.details &&
    typeof err.details === 'object' &&
    'fieldErrors' in err.details
  ) {
    const fieldErrors = (err.details as { fieldErrors?: Record<string, string[]> })
      .fieldErrors;
    const messages = fieldErrors?.[field];
    if (Array.isArray(messages) && messages.length > 0) return messages[0];
  }
  return null;
}

/**
 * Base HTTP client. Prefixes the configured API URL, sends/receives JSON, and
 * normalizes error responses into `ApiRequestError`. Feature APIs build on this
 * rather than calling `fetch` directly.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authStorage.get();
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    let details: unknown;
    try {
      const body = (await res.json()) as ApiError;
      if (body.error?.message) message = body.error.message;
      details = body.error?.details;
    } catch {
      // response had no JSON body — keep the default message
    }
    throw new ApiRequestError(res.status, message, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
