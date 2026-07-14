import { randomBytes } from 'node:crypto';
import { env } from '../../infra/env';

/** Google OAuth 2.0 endpoints (authorization-code flow). */
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

/** The feature is active only when both client credentials are configured. */
export function googleEnabled(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** A random anti-CSRF state value (stored in a cookie, echoed back by Google). */
export function newState(): string {
  return randomBytes(16).toString('hex');
}

/** Build the Google consent URL the browser is redirected to. */
export function consentUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleUser {
  email: string;
  name: string;
  verified: boolean;
}

/**
 * Exchange the authorization code for tokens and fetch the user's profile.
 * The token exchange is authenticated with our client secret over TLS, so the
 * userinfo it yields is trusted.
 */
export async function fetchGoogleUser(
  code: string,
  redirectUri: string,
): Promise<GoogleUser> {
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) throw new Error('Google token exchange failed');
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error('No access token from Google');

  const infoRes = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) throw new Error('Google userinfo request failed');
  const info = (await infoRes.json()) as {
    email?: string;
    verified_email?: boolean;
    name?: string;
  };
  if (!info.email) throw new Error('Google account has no email');

  return {
    email: info.email.toLowerCase(),
    name: info.name?.trim() || info.email.split('@')[0],
    // Fail closed: only treat the address as verified when Google explicitly
    // says so (a missing field must not pass as verified).
    verified: info.verified_email === true,
  };
}
