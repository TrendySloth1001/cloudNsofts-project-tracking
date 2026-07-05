import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  userRoleSchema,
  type ApiTokenSummary,
  type AuthResponse,
  type AuthUser,
  type CreateApiTokenInput,
  type CreatedApiToken,
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

/** Personal Access Tokens carry this prefix so they're told apart from JWTs. */
const PAT_PREFIX = 'cnsofts_pat_';
const DAY_MS = 24 * 60 * 60 * 1000;

/** sha-256 hex of a token — only this is stored (the plaintext is shown once). */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function toTokenSummary(row: {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}): ApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  };
}

/** Reconstruct a principal from a token's stored `userId` (role read live). */
async function principalFromId(userId: string): Promise<AuthUser | null> {
  if (userId === adminUser.id) return adminUser;
  const record = await prisma.user.findUnique({ where: { id: userId } });
  if (!record) return null;
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
  };
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

  /* --------------------------- Access tokens ---------------------------- */

  /** True when a bearer value is a Personal Access Token (vs. a JWT). */
  isApiToken(token: string): boolean {
    return token.startsWith(PAT_PREFIX);
  },

  /** Mint a PAT for the principal; the plaintext is returned exactly once. */
  async createApiToken(
    principal: AuthUser,
    input: CreateApiTokenInput,
  ): Promise<CreatedApiToken> {
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * DAY_MS)
      : null;
    const row = await prisma.apiToken.create({
      data: {
        userId: principal.id,
        name: input.name,
        tokenHash: hashToken(raw),
        expiresAt,
      },
    });
    return { token: raw, apiToken: toTokenSummary(row) };
  },

  /** List the principal's active (non-revoked) tokens — never the secret. */
  async listApiTokens(principal: AuthUser): Promise<ApiTokenSummary[]> {
    const rows = await prisma.apiToken.findMany({
      where: { userId: principal.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toTokenSummary);
  },

  /** Revoke one of the principal's tokens (404 if it isn't theirs). */
  async revokeApiToken(principal: AuthUser, id: string): Promise<void> {
    const row = await prisma.apiToken.findFirst({
      where: { id, userId: principal.id, revokedAt: null },
    });
    if (!row) throw HttpError.notFound('Token not found');
    await prisma.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  /** Verify a PAT against the DB and reconstruct the acting principal. */
  async verifyApiToken(raw: string): Promise<AuthUser> {
    const row = await prisma.apiToken.findUnique({
      where: { tokenHash: hashToken(raw) },
    });
    if (
      !row ||
      row.revokedAt !== null ||
      (row.expiresAt !== null && row.expiresAt.getTime() < Date.now())
    ) {
      throw HttpError.unauthorized('Invalid or expired token');
    }
    const principal = await principalFromId(row.userId);
    if (!principal) throw HttpError.unauthorized('Invalid or expired token');
    // Best-effort last-used stamp; never block the request on it.
    void prisma.apiToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return principal;
  },
};
