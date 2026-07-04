import { createUserSchema, updateUserSchema } from '@cnsofts/shared';
import { asyncHandler } from '../../shared/http/async-handler';
import { validate } from '../../shared/http/validate';
import { usersService } from './users.service';

/** Thin HTTP layer: validate input, delegate to the service, shape the response. */
export const usersController = {
  list: asyncHandler(async (_req, res) => {
    res.json(await usersService.list());
  }),

  create: asyncHandler(async (req, res) => {
    const input = validate(createUserSchema, req.body);
    res.status(201).json(await usersService.create(input));
  }),

  getById: asyncHandler(async (req, res) => {
    res.json(await usersService.getById(req.params.id));
  }),

  update: asyncHandler(async (req, res) => {
    const input = validate(updateUserSchema, req.body);
    res.json(await usersService.update(req.params.id, input));
  }),

  remove: asyncHandler(async (req, res) => {
    await usersService.remove(req.params.id);
    res.status(204).end();
  }),
};
