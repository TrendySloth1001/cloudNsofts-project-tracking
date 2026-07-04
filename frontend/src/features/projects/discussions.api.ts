import {
  apiPaths,
  type Channel,
  type CreateChannelInput,
  type Message,
  type PostMessageInput,
} from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/** Typed data-access for a project's discussion channels + messages. */
export const discussionsApi = {
  listChannels: (projectId: string) =>
    apiClient.get<Channel[]>(apiPaths.projects.channels(projectId)),
  createChannel: (projectId: string, input: CreateChannelInput) =>
    apiClient.post<Channel>(apiPaths.projects.channels(projectId), input),
  removeChannel: (projectId: string, channelId: string) =>
    apiClient.delete<void>(apiPaths.projects.channel(projectId, channelId)),
  listMessages: (projectId: string, channelId: string) =>
    apiClient.get<Message[]>(
      apiPaths.projects.channelMessages(projectId, channelId),
    ),
  postMessage: (projectId: string, channelId: string, input: PostMessageInput) =>
    apiClient.post<Message>(
      apiPaths.projects.channelMessages(projectId, channelId),
      input,
    ),
};
