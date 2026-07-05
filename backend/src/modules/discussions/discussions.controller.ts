import {
  addChannelMemberSchema,
  createChannelSchema,
  listMessagesQuerySchema,
  postMessageSchema,
} from '@cnsofts/shared';
import { asyncHandler } from '../../shared/http/async-handler';
import { validate } from '../../shared/http/validate';
import { requireUser } from '../auth/access';
import { discussionsService } from './discussions.service';

export const discussionsController = {
  listChannels: asyncHandler(async (req, res) => {
    res.json(
      await discussionsService.listChannels(req.params.id, requireUser(req)),
    );
  }),
  createChannel: asyncHandler(async (req, res) => {
    const input = validate(createChannelSchema, req.body);
    res
      .status(201)
      .json(
        await discussionsService.createChannel(
          req.params.id,
          input,
          requireUser(req),
        ),
      );
  }),
  removeChannel: asyncHandler(async (req, res) => {
    await discussionsService.removeChannel(
      req.params.id,
      req.params.channelId,
      requireUser(req),
    );
    res.status(204).end();
  }),

  listMembers: asyncHandler(async (req, res) => {
    res.json(
      await discussionsService.listMembers(
        req.params.id,
        req.params.channelId,
        requireUser(req),
      ),
    );
  }),
  addMember: asyncHandler(async (req, res) => {
    const input = validate(addChannelMemberSchema, req.body);
    res
      .status(201)
      .json(
        await discussionsService.addMember(
          req.params.id,
          req.params.channelId,
          input,
          requireUser(req),
        ),
      );
  }),
  removeMember: asyncHandler(async (req, res) => {
    await discussionsService.removeMember(
      req.params.id,
      req.params.channelId,
      req.params.memberId,
      requireUser(req),
    );
    res.status(204).end();
  }),

  listMessages: asyncHandler(async (req, res) => {
    const query = validate(listMessagesQuerySchema, req.query);
    res.json(
      await discussionsService.listMessages(
        req.params.id,
        req.params.channelId,
        query,
        requireUser(req),
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
          requireUser(req),
          input,
          req.agentName ?? null,
        ),
      );
  }),
  removeMessage: asyncHandler(async (req, res) => {
    await discussionsService.removeMessage(
      req.params.id,
      req.params.channelId,
      req.params.messageId,
      requireUser(req),
    );
    res.status(204).end();
  }),
};
