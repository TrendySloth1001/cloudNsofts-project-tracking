import { Prisma } from '@prisma/client';
import type { CreateUserInput, UpdateUserInput } from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

function isNotFound(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025'
  );
}

const EMAIL_TAKEN = 'A user with that email already exists';
const USER_NOT_FOUND = 'User not found';

/** Business logic and persistence for users. Controllers stay thin; this is
 *  where domain rules and database access live. */
export const usersService = {
  list() {
    return prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  },

  async getById(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw HttpError.notFound(USER_NOT_FOUND);
    return user;
  },

  async create(input: CreateUserInput) {
    try {
      return await prisma.user.create({ data: input });
    } catch (err) {
      if (isUniqueViolation(err)) throw HttpError.conflict(EMAIL_TAKEN);
      throw err;
    }
  },

  async update(id: string, input: UpdateUserInput) {
    try {
      return await prisma.user.update({ where: { id }, data: input });
    } catch (err) {
      if (isNotFound(err)) throw HttpError.notFound(USER_NOT_FOUND);
      if (isUniqueViolation(err)) throw HttpError.conflict(EMAIL_TAKEN);
      throw err;
    }
  },

  async remove(id: string) {
    try {
      await prisma.user.delete({ where: { id } });
    } catch (err) {
      if (isNotFound(err)) throw HttpError.notFound(USER_NOT_FOUND);
      throw err;
    }
  },
};
