import {
  apiPaths,
  type AddChannelMemberInput,
  type Channel,
  type ChannelMember,
  type CreateChannelInput,
  type ListMessagesQuery,
  type Message,
  type PostMessageInput,
  type ScheduledMessage,
  type ScheduleMessageInput,
} from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/** Build a `?before&after&limit` query string for message history paging. */
function messagesPath(
  projectId: string,
  channelId: string,
  query?: Partial<ListMessagesQuery>,
): string {
  const base = apiPaths.projects.channelMessages(projectId, channelId);
  const params = new URLSearchParams();
  if (query?.before) params.set('before', query.before);
  if (query?.after) params.set('after', query.after);
  if (query?.limit != null) params.set('limit', String(query.limit));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Typed data-access for a project's discussion channels + messages. */
export const discussionsApi = {
  listChannels: (projectId: string) =>
    apiClient.get<Channel[]>(apiPaths.projects.channels(projectId)),
  createChannel: (projectId: string, input: CreateChannelInput) =>
    apiClient.post<Channel>(apiPaths.projects.channels(projectId), input),
  removeChannel: (projectId: string, channelId: string) =>
    apiClient.delete<void>(apiPaths.projects.channel(projectId, channelId)),
  listMessages: (
    projectId: string,
    channelId: string,
    query?: Partial<ListMessagesQuery>,
  ) => apiClient.get<Message[]>(messagesPath(projectId, channelId, query)),
  postMessage: (projectId: string, channelId: string, input: PostMessageInput) =>
    apiClient.post<Message>(
      apiPaths.projects.channelMessages(projectId, channelId),
      input,
    ),
  deleteMessage: (projectId: string, channelId: string, messageId: string) =>
    apiClient.delete<void>(
      apiPaths.projects.channelMessage(projectId, channelId, messageId),
    ),

  resolveChannel: (projectId: string, channelId: string, resolved: boolean) =>
    apiClient.post<Channel>(apiPaths.projects.channelResolve(projectId, channelId), {
      resolved,
    }),

  listScheduled: (projectId: string, channelId: string) =>
    apiClient.get<ScheduledMessage[]>(
      apiPaths.projects.channelScheduled(projectId, channelId),
    ),
  scheduleMessage: (
    projectId: string,
    channelId: string,
    input: ScheduleMessageInput,
  ) =>
    apiClient.post<ScheduledMessage>(
      apiPaths.projects.channelScheduled(projectId, channelId),
      input,
    ),
  cancelScheduled: (projectId: string, channelId: string, scheduledId: string) =>
    apiClient.delete<void>(
      apiPaths.projects.channelScheduledItem(projectId, channelId, scheduledId),
    ),

  listMembers: (projectId: string, channelId: string) =>
    apiClient.get<ChannelMember[]>(
      apiPaths.projects.channelMembers(projectId, channelId),
    ),
  addMember: (
    projectId: string,
    channelId: string,
    input: AddChannelMemberInput,
  ) =>
    apiClient.post<ChannelMember>(
      apiPaths.projects.channelMembers(projectId, channelId),
      input,
    ),
  removeMember: (projectId: string, channelId: string, memberId: string) =>
    apiClient.delete<void>(
      apiPaths.projects.channelMember(projectId, channelId, memberId),
    ),
};
