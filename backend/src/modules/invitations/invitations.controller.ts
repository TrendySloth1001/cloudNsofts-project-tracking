import { createInvitationSchema } from '@cnsofts/shared';
import { asyncHandler } from '../../shared/http/async-handler';
import { HttpError } from '../../shared/http/http-error';
import { validate } from '../../shared/http/validate';
import { requireUser } from '../auth/access';
import { invitationsService } from './invitations.service';

export const invitationsController = {
  /* ----- Project-scoped (manager/admin) ----- */
  create: asyncHandler(async (req, res) => {
    const input = validate(createInvitationSchema, req.body);
    // Inviting someone as admin (owner) is reserved for project admins — a
    // manager can't mint co-owners through an invitation either.
    if (input.role === 'admin' && req.projectRole !== 'admin') {
      throw HttpError.forbidden('Only a project admin can invite an admin.');
    }
    res
      .status(201)
      .json(
        await invitationsService.create(req.params.id, input, requireUser(req)),
      );
  }),

  listForProject: asyncHandler(async (req, res) => {
    res.json({
      invitations: await invitationsService.listForProject(req.params.id),
    });
  }),

  cancel: asyncHandler(async (req, res) => {
    await invitationsService.cancel(req.params.id, req.params.inviteId);
    res.status(204).end();
  }),

  /* ----- The caller's own invitations ----- */
  listMine: asyncHandler(async (req, res) => {
    res.json({
      invitations: await invitationsService.listMine(requireUser(req)),
    });
  }),

  accept: asyncHandler(async (req, res) => {
    res.json({
      invitation: await invitationsService.accept(
        req.params.id,
        requireUser(req),
      ),
    });
  }),

  decline: asyncHandler(async (req, res) => {
    res.json({
      invitation: await invitationsService.decline(
        req.params.id,
        requireUser(req),
      ),
    });
  }),
};
