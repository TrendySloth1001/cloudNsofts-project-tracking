import type { ApiError } from '@cnsofts/shared';
import { config } from './config.js';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * Thin REST client over the CloudNSofts API. Sends the PAT as a bearer token so
 * every call runs with the token owner's permissions; normalizes the backend
 * `ApiError` envelope into a plain Error whose message surfaces to the agent.
 */
async function request<T = unknown>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status})`;
    try {
      const envelope = (await res.json()) as ApiError;
      if (envelope.error?.message) message = envelope.error.message;
    } catch {
      // no JSON body — keep the status-based message
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T = unknown>(path: string) => request<T>('GET', path),
  post: <T = unknown>(path: string, body: unknown) =>
    request<T>('POST', path, body),
  patch: <T = unknown>(path: string, body: unknown) =>
    request<T>('PATCH', path, body),
  delete: <T = unknown>(path: string) => request<T>('DELETE', path),
};
