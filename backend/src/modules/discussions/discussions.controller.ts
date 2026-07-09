import {
  addChannelMemberSchema,
  channelWaitQuerySchema,
  createChannelSchema,
  listMessagesQuerySchema,
  postMessageSchema,
  resolveChannelSchema,
  scheduleMessageSchema,
  searchConversationsQuerySchema,
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

  getMessage: asyncHandler(async (req, res) => {
    res.json(
      await discussionsService.getMessage(
        req.params.id,
        req.params.channelId,
        req.params.messageId,
        requireUser(req),
      ),
    );
  }),

  channelOverview: asyncHandler(async (req, res) => {
    res.json(
      await discussionsService.getChannelOverview(
        req.params.id,
        req.params.channelId,
        requireUser(req),
      ),
    );
  }),

  waitForReply: asyncHandler(async (req, res) => {
    const query = validate(channelWaitQuerySchema, req.query);
    res.json(
      await discussionsService.waitForReply(
        req.params.id,
        req.params.channelId,
        requireUser(req),
        req.agentName ?? null,
        query,
      ),
    );
  }),

  resolveChannel: asyncHandler(async (req, res) => {
    const input = validate(resolveChannelSchema, req.body);
    res.json(
      await discussionsService.resolveChannel(
        req.params.id,
        req.params.channelId,
        requireUser(req),
        input.resolved,
      ),
    );
  }),

  searchConversations: asyncHandler(async (req, res) => {
    const query = validate(searchConversationsQuerySchema, req.query);
    const results = await discussionsService.searchConversations(
      req.params.id,
      query,
      requireUser(req),
      req.projectRole ?? null,
    );
    res.json({ results });
  }),

  scheduleMessage: asyncHandler(async (req, res) => {
    const input = validate(scheduleMessageSchema, req.body);
    res
      .status(201)
      .json(
        await discussionsService.createScheduledMessage(
          req.params.id,
          req.params.channelId,
          requireUser(req),
          input,
          req.agentName ?? null,
        ),
      );
  }),

  listScheduled: asyncHandler(async (req, res) => {
    res.json(
      await discussionsService.listScheduledMessages(
        req.params.id,
        req.params.channelId,
        requireUser(req),
      ),
    );
  }),

  cancelScheduled: asyncHandler(async (req, res) => {
    await discussionsService.cancelScheduledMessage(
      req.params.id,
      req.params.channelId,
      req.params.scheduledId,
      requireUser(req),
    );
    res.status(204).end();
  }),
};
