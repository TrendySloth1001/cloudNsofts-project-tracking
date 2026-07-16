import { apiPaths, type ApiError } from '@cnsofts/shared';
import { config } from './config';
import { readCsrfToken } from './auth-storage';

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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** A single in-flight refresh, shared so concurrent 401s trigger only one. */
let refreshInflight: Promise<boolean> | null = null;

/** Try to mint a fresh access token from the refresh cookie. Returns whether it
 *  succeeded. Deduped so a burst of 401s produces one refresh call. */
function tryRefresh(): Promise<boolean> {
  if (!refreshInflight) {
    refreshInflight = fetch(`${config.apiUrl}${apiPaths.auth.refresh()}`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshInflight = null;
      });
  }
  return refreshInflight;
}

/**
 * Base HTTP client. Prefixes the configured API URL, sends/receives JSON, and
 * normalizes error responses into `ApiRequestError`. Auth rides in httpOnly
 * cookies (`credentials: 'include'`); mutating requests echo the CSRF cookie in
 * the `X-CSRF-Token` header. On a 401 it transparently refreshes the access
 * token once and retries. Feature APIs build on this rather than calling
 * `fetch` directly.
 */
async function request<T>(
  path: string,
  init?: RequestInit,
  allowRefresh = true,
): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const csrf = readCsrfToken();
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf && !SAFE_METHODS.has(method) ? { 'X-CSRF-Token': csrf } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  // Access token expired → refresh once and retry the original request. Skip
  // for the auth endpoints themselves to avoid loops.
  if (
    res.status === 401 &&
    allowRefresh &&
    !path.startsWith(apiPaths.auth.refresh()) &&
    !path.startsWith(apiPaths.auth.login())
  ) {
    if (await tryRefresh()) return request<T>(path, init, false);
  }

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
  /** Upload raw binary (e.g. an image) with an explicit Content-Type. */
  upload: <T>(path: string, body: Blob, contentType: string) =>
    request<T>(path, {
      method: 'POST',
      body,
      headers: { 'Content-Type': contentType },
    }),
};
