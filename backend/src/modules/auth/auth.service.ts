import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AuthResponse, AuthUser, LoginInput } from '@cnsofts/shared';
import { env } from '../../infra/env';
import { HttpError } from '../../shared/http/http-error';

/**
 * Auth for an invite-only app. For now the only account is the bootstrap admin
 * defined in env; this is where a database-backed user check would slot in later.
 */
const adminUser: AuthUser = {
  id: 'admin',
  email: env.ADMIN_EMAIL,
  name: 'Admin',
  role: 'ADMIN',
};

interface TokenPayload {
  sub: string;
  email: string;
  role: AuthUser['role'];
}

/** Length-safe, constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const authService = {
  login(input: LoginInput): AuthResponse {
    const emailMatches = safeEqual(input.email, env.ADMIN_EMAIL);
    const passwordMatches = safeEqual(input.password, env.ADMIN_PASSWORD);
    if (!emailMatches || !passwordMatches) {
      throw HttpError.unauthorized('Invalid email or password');
    }

    const signOptions: jwt.SignOptions = {
      subject: adminUser.id,
      expiresIn: env.AUTH_TOKEN_TTL as unknown as jwt.SignOptions['expiresIn'],
    };
    const token = jwt.sign(
      { email: adminUser.email, role: adminUser.role },
      env.AUTH_SECRET,
      signOptions,
    );

    return { token, user: adminUser };
  },

  verify(token: string): AuthUser {
    try {
      const payload = jwt.verify(token, env.AUTH_SECRET) as TokenPayload;
      if (payload.sub !== adminUser.id) {
        throw new Error('Unknown subject');
      }
      return adminUser;
    } catch {
      throw HttpError.unauthorized('Invalid or expired token');
    }
  },
};
