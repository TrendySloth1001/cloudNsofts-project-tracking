import { createChannelSchema, postMessageSchema } from '@cnsofts/shared';
import type { Request } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import { validate } from '../../shared/http/validate';
import { discussionsService } from './discussions.service';

/** Display name of the authenticated actor, for message authorship. */
function actorName(req: Request): string {
  return req.authUser?.name ?? 'Someone';
}

export const discussionsController = {
  listChannels: asyncHandler(async (req, res) => {
    res.json(await discussionsService.listChannels(req.params.id));
  }),
  createChannel: asyncHandler(async (req, res) => {
    const input = validate(createChannelSchema, req.body);
    res
      .status(201)
      .json(await discussionsService.createChannel(req.params.id, input));
  }),
  removeChannel: asyncHandler(async (req, res) => {
    await discussionsService.removeChannel(req.params.id, req.params.channelId);
    res.status(204).end();
  }),
  listMessages: asyncHandler(async (req, res) => {
    res.json(
      await discussionsService.listMessages(
        req.params.id,
        req.params.channelId,
      ),
    );
  }),
  postMessage: asyncHandler(async (req, res) => {
    const input = validate(postMessageSchema, req.body);
    res
      .status(201)
      .json(
        await discussionsService.postMessage(
          req.params.id,
          req.params.channelId,
          actorName(req),
          input,
        ),
      );
  }),
};
