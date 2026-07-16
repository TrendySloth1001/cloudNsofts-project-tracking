import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  apiTokenScopeSchema,
  userRoleSchema,
  type AgentActivity,
  type AppDensity,
  type AppTheme,
  type ApiTokenScope,
  type ApiTokenSummary,
  type AuthUser,
  type CreateApiTokenInput,
  type CreatedApiToken,
  type LoginInput,
  type SignupInput,
  type TokenVerifyResult,
  type UpdateApiTokenInput,
  type UpdateProfileInput,
  type UserProfile,
} from '@cnsofts/shared';
import { env } from '../../infra/env';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';
import { rosterScopeWhere } from './access';
import { isPlatformAdmin, safeEqual } from './platform-admin';

// Re-exported for consumers that historically imported it from this module.
export { isPlatformAdmin } from './platform-admin';

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

/**
 * Pre-hash a password before bcrypt. bcrypt silently truncates its input at 72
 * bytes, so without this two long passwords sharing a 72-byte prefix would
 * authenticate interchangeably (and the tail of a long password would carry no
 * weight). Feeding bcrypt a fixed-size SHA-256 digest preserves the full
 * password's entropy regardless of length. base64 (~44 bytes) stays under 72.
 */
function preHash(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('base64');
}

/** bcrypt hash of a password (via {@link preHash}). The one place hashing
 *  happens, so signup and admin-provisioning stay in lockstep with verify. */
function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(preHash(plain), BCRYPT_ROUNDS);
}

/**
 * A throwaway bcrypt hash, computed once at startup, compared against when the
 * email is unknown. Login always performs the same bcrypt work whether or not
 * the account exists, so response time can't be used to enumerate valid emails.
 */
const DUMMY_HASH = bcrypt.hashSync(preHash('no-such-account'), BCRYPT_ROUNDS);

/** Personal Access Tokens carry this prefix so they're told apart from JWTs. */
const PAT_PREFIX = 'cnsofts_pat_';
const DAY_MS = 24 * 60 * 60 * 1000;
/** How many recent agent actions the activity feed returns. */
const ACTIVITY_LIMIT = 20;

/** sha-256 hex of a token — only this is stored (the plaintext is shown once). */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Normalize the stored scope string to the contract's union (default full). */
function toScope(value: string): ApiTokenScope {
  const parsed = apiTokenScopeSchema.safeParse(value);
  return parsed.success ? parsed.data : 'full';
}

function toTokenSummary(row: {
  id: string;
  name: string;
  scope: string;
  projectIds: string[];
  canDelete: boolean;
  usageCount: number;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}): ApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    scope: toScope(row.scope),
    projectIds: row.projectIds,
    canDelete: row.canDelete,
    usageCount: row.usageCount,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  };
}

/** Keep only the project ids the principal can actually access (drop foreign
 *  ids so a token can't be scoped to a project the owner can't see). */
async function scopedProjectIds(
  principal: AuthUser,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.project.findMany({
    // A PAT grants *content* access as the principal, so it may only be scoped
    // to roster projects — even for the platform admin (whose cross-project
    // reach is metadata-only, not tokenable content access).
    where: { id: { in: ids }, ...rosterScopeWhere(principal) },
    select: { id: true },
  });
  return rows.map((r) => r.id);
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

/** Mint a short-lived access JWT for a browser session (carried in an httpOnly
 *  cookie). Short by design — the refresh token silently renews it, and its
 *  brevity bounds how long a leaked access token is replayable. */
function issueAccessToken(user: AuthUser): string {
  const signOptions: jwt.SignOptions = {
    subject: user.id,
    expiresIn: env.ACCESS_TOKEN_TTL as unknown as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(
    { email: user.email, name: user.name, role: user.role },
    env.AUTH_SECRET,
    signOptions,
  );
}

/** Metadata captured on a session for auditing / anomaly checks. */
interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

/** A freshly minted access token + the raw refresh token to drop in a cookie. */
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/** Opaque refresh token — random, never a JWT (it carries no claims; the DB row
 *  is the source of truth so it can be revoked). */
function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Open a new session for a user: persist the (hashed) refresh token and return
 *  both tokens. */
async function createSession(
  user: AuthUser,
  meta: SessionMeta,
): Promise<SessionTokens> {
  const refreshToken = newRefreshToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
      userAgent: meta.userAgent?.slice(0, 300),
      ip: meta.ip,
    },
  });
  return { accessToken: issueAccessToken(user), refreshToken };
}

/** Empty profile defaults for a principal with no `users` row yet. */
const EMPTY_PROFILE = {
  title: '',
  bio: '',
  skills: [] as string[],
  location: '',
  timezone: '',
  githubUrl: '',
  websiteUrl: '',
  linkedinUrl: '',
  theme: 'light',
  density: 'comfortable',
} as const;

type ProfileRow = {
  name: string;
  title: string;
  bio: string;
  skills: string[];
  location: string;
  timezone: string;
  githubUrl: string;
  websiteUrl: string;
  linkedinUrl: string;
  theme: AppTheme;
  density: AppDensity;
};

/** Merge the auth identity (email/role from the token) with the DB profile row.
 *  Falls back to empty profile + identity name when no row exists yet (e.g. the
 *  bootstrap admin before its first save). */
function toProfile(user: AuthUser, row: ProfileRow | null): UserProfile {
  const isPlatformAdminUser = isPlatformAdmin(user);
  if (!row) {
    return { ...user, ...EMPTY_PROFILE, isPlatformAdmin: isPlatformAdminUser };
  }
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isPlatformAdmin: isPlatformAdminUser,
    // Once a row exists the name is self-edited there; else use the identity.
    name: row.name || user.name,
    title: row.title,
    bio: row.bio,
    skills: row.skills,
    location: row.location,
    timezone: row.timezone,
    githubUrl: row.githubUrl,
    websiteUrl: row.websiteUrl,
    linkedinUrl: row.linkedinUrl,
    theme: row.theme,
    density: row.density,
  };
}

/** Trim, drop blanks, and de-duplicate skills (case-insensitive), keeping order. */
function normalizeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    const skill = raw.trim();
    const key = skill.toLowerCase();
    if (skill && !seen.has(key)) {
      seen.add(key);
      out.push(skill);
    }
  }
  return out;
}

export const authService = {
  /** Hash a plaintext password for storage (used when provisioning users). */
  hashPassword(plain: string): Promise<string> {
    return hashPassword(plain);
  },

  /** The signed-in user's full profile (identity + DB profile fields). */
  async getProfile(user: AuthUser): Promise<UserProfile> {
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    return toProfile(user, row);
  },

  /** Update the caller's own profile. Upserts the `users` row so the env
   *  bootstrap admin (which has no row) gets one on first save. */
  async updateProfile(
    user: AuthUser,
    input: UpdateProfileInput,
  ): Promise<UserProfile> {
    const data = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.skills !== undefined
        ? { skills: normalizeSkills(input.skills) }
        : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.githubUrl !== undefined ? { githubUrl: input.githubUrl } : {}),
      ...(input.websiteUrl !== undefined
        ? { websiteUrl: input.websiteUrl }
        : {}),
      ...(input.linkedinUrl !== undefined
        ? { linkedinUrl: input.linkedinUrl }
        : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.density !== undefined ? { density: input.density } : {}),
    };
    const row = await prisma.user.upsert({
      where: { id: user.id },
      update: data,
      create: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: input.name ?? user.name,
        ...data,
      },
    });
    return toProfile(user, row);
  },

  async login(input: LoginInput): Promise<AuthUser> {
    // 1) Bootstrap admin from env (constant-time compare).
    if (safeEqual(input.email, env.ADMIN_EMAIL)) {
      if (!safeEqual(input.password, env.ADMIN_PASSWORD)) {
        throw HttpError.unauthorized('Invalid email or password');
      }
      return adminUser;
    }

    // 2) DB-backed users. Run the SAME bcrypt work whether or not the account
    //    exists (compare against a dummy hash when it doesn't) so response time
    //    never reveals which emails are registered. Two comparisons cover both
    //    the current pre-hash scheme and any legacy raw-bcrypt hash.
    const record = await prisma.user.findUnique({
      where: { email: input.email },
    });
    const hash = record?.passwordHash ?? DUMMY_HASH;
    const newSchemeOk = await bcrypt.compare(preHash(input.password), hash);
    const legacyOk = await bcrypt.compare(input.password, hash);
    const authed = Boolean(record?.passwordHash) && (newSchemeOk || legacyOk);
    if (!authed || !record) {
      throw HttpError.unauthorized('Invalid email or password');
    }

    // Lazily upgrade a legacy raw-bcrypt hash to the pre-hash scheme, in the
    // background so it never delays the login response.
    if (legacyOk && !newSchemeOk) {
      void (async () => {
        const migrated = await hashPassword(input.password);
        await prisma.user.update({
          where: { id: record.id },
          data: { passwordHash: migrated },
        });
      })().catch(() => undefined);
    }

    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
    };
  },

  /**
   * Sign in (or provision) a user from a verified Google identity. Mirrors open
   * signup: a first-time Google user becomes a plain MEMBER with no project
   * access until invited, and has no password (they sign in via Google only).
   * The reserved env admin email resolves to the bootstrap admin principal.
   */
  async loginWithGoogle(email: string, name: string): Promise<AuthUser> {
    if (safeEqual(email, env.ADMIN_EMAIL)) {
      return adminUser;
    }
    let record = await prisma.user.findUnique({ where: { email } });
    if (!record) {
      record = await prisma.user.create({
        data: { email, name, role: 'MEMBER' },
      });
    }
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
    };
  },

  /** Open self-service signup. New accounts are plain MEMBERs with no project
   *  access until they accept an invitation (or an admin adds them). */
  async signup(input: SignupInput): Promise<AuthUser> {
    // The bootstrap admin email is reserved.
    if (safeEqual(input.email, env.ADMIN_EMAIL)) {
      throw HttpError.conflict('That email is already registered.');
    }
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw HttpError.conflict('That email is already registered.');
    }
    const passwordHash = await hashPassword(input.password);
    const record = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: 'MEMBER',
        passwordHash,
      },
    });
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
    };
  },

  /** Open a browser session for a freshly-authenticated user: mint the access
   *  JWT and a persisted, revocable refresh token. */
  startSession(user: AuthUser, meta: SessionMeta): Promise<SessionTokens> {
    return createSession(user, meta);
  },

  /**
   * Exchange a refresh token for a new access token + a rotated refresh token.
   * Returns null (caller → 401) if the token is unknown, expired, or revoked.
   * Reuse of an already-rotated token is treated as theft: every live session
   * for that user is revoked.
   */
  async refreshSession(
    rawRefresh: string,
    meta: SessionMeta,
  ): Promise<{ user: AuthUser; tokens: SessionTokens } | null> {
    const row = await prisma.session.findUnique({
      where: { tokenHash: hashToken(rawRefresh) },
    });
    if (!row) return null;
    if (row.revokedAt !== null) {
      // A revoked token being presented again → the chain leaked. Burn it all.
      await prisma.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }
    if (row.expiresAt.getTime() < Date.now()) return null;
    const principal = await principalFromId(row.userId);
    if (!principal) return null;

    // Rotate: mint a successor and revoke the consumed token.
    const refreshToken = newRefreshToken();
    const created = await prisma.session.create({
      data: {
        userId: row.userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
        userAgent: meta.userAgent?.slice(0, 300),
        ip: meta.ip,
      },
    });
    await prisma.session.update({
      where: { id: row.id },
      data: {
        revokedAt: new Date(),
        replacedById: created.id,
        lastUsedAt: new Date(),
      },
    });
    return {
      user: principal,
      tokens: { accessToken: issueAccessToken(principal), refreshToken },
    };
  },

  /** Revoke a single session by its refresh token (logout). Idempotent. */
  async revokeSession(rawRefresh: string): Promise<void> {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(rawRefresh), revokedAt: null },
      data: { revokedAt: new Date() },
    });
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
    const projectIds = await scopedProjectIds(principal, input.projectIds);
    const row = await prisma.apiToken.create({
      data: {
        userId: principal.id,
        name: input.name,
        tokenHash: hashToken(raw),
        scope: input.scope,
        projectIds,
        canDelete: input.canDelete,
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

  /** Rename one of the principal's tokens (404 if it isn't theirs). */
  async updateApiToken(
    principal: AuthUser,
    id: string,
    input: UpdateApiTokenInput,
  ): Promise<ApiTokenSummary> {
    const row = await prisma.apiToken.findFirst({
      where: { id, userId: principal.id, revokedAt: null },
    });
    if (!row) throw HttpError.notFound('Token not found');
    const updated = await prisma.apiToken.update({
      where: { id },
      data: { name: input.name },
    });
    return toTokenSummary(updated);
  },

  /**
   * Rotate a token: revoke the old secret and issue a new one that keeps the
   * same name, scope, project restriction, and expiry. Returns the new plaintext
   * (shown once) — so a leaked token can be replaced without reconfiguring.
   */
  async rotateApiToken(
    principal: AuthUser,
    id: string,
  ): Promise<CreatedApiToken> {
    const old = await prisma.apiToken.findFirst({
      where: { id, userId: principal.id, revokedAt: null },
    });
    if (!old) throw HttpError.notFound('Token not found');
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    const [, created] = await prisma.$transaction([
      prisma.apiToken.update({
        where: { id },
        data: { revokedAt: new Date() },
      }),
      prisma.apiToken.create({
        data: {
          userId: principal.id,
          name: old.name,
          tokenHash: hashToken(raw),
          scope: old.scope,
          projectIds: old.projectIds,
          canDelete: old.canDelete,
          expiresAt: old.expiresAt,
        },
      }),
    ]);
    return { token: raw, apiToken: toTokenSummary(created) };
  },

  /** Check whether one of the caller's tokens still works, from its stored
   *  record — no raw key required (the plaintext is never stored). Mirrors the
   *  same rules {@link verifyApiToken} enforces, but keyed by id + ownership and
   *  without stamping usage (a status check isn't a use). */
  async verifyOwnedToken(
    principal: AuthUser,
    id: string,
  ): Promise<TokenVerifyResult> {
    const row = await prisma.apiToken.findFirst({
      where: { id, userId: principal.id },
    });
    if (!row) throw HttpError.notFound('Token not found');
    if (row.revokedAt !== null) {
      return { valid: false, reason: 'Revoked — this token no longer works.' };
    }
    if (row.expiresAt !== null && row.expiresAt.getTime() < Date.now()) {
      const on = row.expiresAt.toISOString().slice(0, 10);
      return { valid: false, reason: `Expired on ${on} — generate a new token.` };
    }
    return {
      valid: true,
      reason: `Active and working — authenticates as ${principal.name}.`,
    };
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

  /** Verify a PAT against the DB and reconstruct the acting principal. Returns
   *  the token's name (for "via <agent>" attribution) and its scope so the
   *  middleware can enforce read-only / project restrictions. */
  async verifyApiToken(raw: string): Promise<{
    user: AuthUser;
    tokenName: string;
    scope: ApiTokenScope;
    projectIds: string[];
    canDelete: boolean;
  }> {
    const row = await prisma.apiToken.findUnique({
      where: { tokenHash: hashToken(raw) },
    });
    // Say WHY a token fails — the caller already holds the value, so a precise
    // reason leaks nothing but saves them chasing the wrong problem (the common
    // one being a revoke, not an expiry).
    if (!row) {
      throw HttpError.unauthorized(
        'This access token is not recognized — it may have been deleted. Generate a new one on the Connect coding agent page and update your MCP config.',
      );
    }
    if (row.revokedAt !== null) {
      throw HttpError.unauthorized(
        'This access token was revoked — regenerating or rotating a token invalidates the previous one. Copy the new token into your MCP config (agent-workspace/.mcp.json).',
      );
    }
    if (row.expiresAt !== null && row.expiresAt.getTime() < Date.now()) {
      const on = row.expiresAt.toISOString().slice(0, 10);
      throw HttpError.unauthorized(
        `This access token expired on ${on}. Generate a new one (choose "Never expires" for an always-on agent).`,
      );
    }
    const principal = await principalFromId(row.userId);
    if (!principal) {
      throw HttpError.unauthorized(
        'The account this token belongs to no longer exists.',
      );
    }
    // Best-effort usage stamp — count the call and record last-used. Never
    // blocks the request; a lost update just under-counts by one.
    void prisma.apiToken
      .update({
        where: { id: row.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
      })
      .catch(() => undefined);
    return {
      user: principal,
      tokenName: row.name,
      scope: toScope(row.scope),
      projectIds: row.projectIds,
      canDelete: row.canDelete,
    };
  },

  /** Recent actions performed by the principal's agents (PATs), newest first,
   *  scoped to projects the principal can see. */
  async getAgentActivity(principal: AuthUser): Promise<AgentActivity[]> {
    // Activity carries task/message bodies (contents), so scope to roster
    // projects only — the platform admin doesn't get a cross-project feed.
    const scope = rosterScopeWhere(principal);
    const [events, messages] = await Promise.all([
      prisma.taskEvent.findMany({
        where: { agentName: { not: null }, task: { project: scope } },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT,
        select: {
          id: true,
          body: true,
          agentName: true,
          createdAt: true,
          task: {
            select: {
              title: true,
              projectId: true,
              project: { select: { name: true } },
            },
          },
        },
      }),
      prisma.message.findMany({
        where: { agentName: { not: null }, channel: { project: scope } },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT,
        select: {
          id: true,
          body: true,
          agentName: true,
          createdAt: true,
          channel: {
            select: {
              name: true,
              projectId: true,
              project: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const activity: AgentActivity[] = [
      ...events.map((e) => ({
        id: `evt_${e.id}`,
        kind: 'task_event' as const,
        agentName: e.agentName ?? 'agent',
        projectId: e.task.projectId,
        projectName: e.task.project.name,
        summary: e.body,
        context: e.task.title,
        createdAt: e.createdAt.toISOString(),
      })),
      ...messages.map((m) => ({
        id: `msg_${m.id}`,
        kind: 'message' as const,
        agentName: m.agentName ?? 'agent',
        projectId: m.channel.projectId,
        projectName: m.channel.project.name,
        summary: m.body,
        context: `#${m.channel.name}`,
        createdAt: m.createdAt.toISOString(),
      })),
    ];

    return activity
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, ACTIVITY_LIMIT);
  },
};
