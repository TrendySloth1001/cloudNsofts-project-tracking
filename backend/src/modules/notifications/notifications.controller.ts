import type { Request } from 'express';
import { updateNotificationPreferenceSchema } from '@cnsofts/shared';
import { asyncHandler } from '../../shared/http/async-handler';
import { HttpError } from '../../shared/http/http-error';
import { validate } from '../../shared/http/validate';
import { notificationsService } from './notifications.service';

/** The authenticated recipient whose notifications are being read/updated. */
function recipient(req: Request): string {
  const id = req.authUser?.id;
  if (!id) throw HttpError.unauthorized('Authentication required');
  return id;
}

export const notificationsController = {
  list: asyncHandler(async (req, res) => {
    res.json(await notificationsService.list(recipient(req)));
  }),

  markAllRead: asyncHandler(async (req, res) => {
    await notificationsService.markAllRead(recipient(req));
    res.status(204).end();
  }),

  markRead: asyncHandler(async (req, res) => {
    await notificationsService.markRead(recipient(req), req.params.id);
    res.status(204).end();
  }),

  getPreferences: asyncHandler(async (req, res) => {
    res.json(await notificationsService.getPreferences(recipient(req)));
  }),

  updatePreference: asyncHandler(async (req, res) => {
    const input = validate(updateNotificationPreferenceSchema, req.body);
    res.json(
      await notificationsService.setPreference(
        recipient(req),
        input.kind,
        input.enabled,
      ),
    );
  }),
};
