import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  userRoleSchema,
  type AuthResponse,
  type AuthUser,
  type LoginInput,
} from '@cnsofts/shared';
import { env } from '../../infra/env';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';

/**
 * Auth for an invite-only app. The bootstrap admin lives in env; all other
 * accounts are DB-backed users (admin-provisioned, with a bcrypt password
 * hash). The JWT carries id/email/name/role so `verify` needs no DB round-trip.
 */
const adminUser: AuthUser = {
  id: 'admin',
  email: env.ADMIN_EMAIL,
  name: 'Admin',
  role: 'ADMIN',
};

const BCRYPT_ROUNDS = 10;

interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: AuthUser['role'];
}

/** Length-safe, constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function issueToken(user: AuthUser): string {
  const signOptions: jwt.SignOptions = {
    subject: user.id,
    expiresIn: env.AUTH_TOKEN_TTL as unknown as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(
    { email: user.email, name: user.name, role: user.role },
    env.AUTH_SECRET,
    signOptions,
  );
}

export const authService = {
  /** Hash a plaintext password for storage (used when provisioning users). */
  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    // 1) Bootstrap admin from env (constant-time compare).
    if (safeEqual(input.email, env.ADMIN_EMAIL)) {
      if (!safeEqual(input.password, env.ADMIN_PASSWORD)) {
        throw HttpError.unauthorized('Invalid email or password');
      }
      return { token: issueToken(adminUser), user: adminUser };
    }

    // 2) DB-backed users must have a password set (invite-provisioned).
    const record = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!record?.passwordHash) {
      throw HttpError.unauthorized('Invalid email or password');
    }
    const matches = await bcrypt.compare(input.password, record.passwordHash);
    if (!matches) throw HttpError.unauthorized('Invalid email or password');

    const user: AuthUser = {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
    };
    return { token: issueToken(user), user };
  },

  /** Verify a token and reconstruct the principal from its payload (no DB hit). */
  verify(token: string): AuthUser {
    try {
      const payload = jwt.verify(token, env.AUTH_SECRET) as TokenPayload;
      return {
        id: payload.sub,
        email: payload.email,
        // Older tokens predate the name claim — fall back so the UI never
        // receives an undefined name.
        name: payload.name ?? payload.email ?? 'User',
        role: userRoleSchema.parse(payload.role),
      };
    } catch {
      throw HttpError.unauthorized('Invalid or expired token');
    }
  },
};
