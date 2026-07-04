import { apiPaths, type NotificationList } from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/** Typed data-access for the current user's notification feed. */
export const notificationsApi = {
  list: () => apiClient.get<NotificationList>(apiPaths.notifications.list()),
  markRead: (id: string) =>
    apiClient.post<void>(apiPaths.notifications.read(id), {}),
  markAllRead: () => apiClient.post<void>(apiPaths.notifications.readAll(), {}),
};
