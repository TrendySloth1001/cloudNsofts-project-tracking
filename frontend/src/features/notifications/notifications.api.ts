import {
  apiPaths,
  type NotificationList,
  type NotificationPreferences,
  type UpdateNotificationPreferenceInput,
} from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/** Typed data-access for the current user's notification feed + preferences. */
export const notificationsApi = {
  list: () => apiClient.get<NotificationList>(apiPaths.notifications.list()),
  markRead: (id: string) =>
    apiClient.post<void>(apiPaths.notifications.read(id), {}),
  markAllRead: () => apiClient.post<void>(apiPaths.notifications.readAll(), {}),
  getPreferences: () =>
    apiClient.get<NotificationPreferences>(
      apiPaths.notifications.preferences(),
    ),
  updatePreference: (input: UpdateNotificationPreferenceInput) =>
    apiClient.put<NotificationPreferences>(
      apiPaths.notifications.preferences(),
      input,
    ),
};
