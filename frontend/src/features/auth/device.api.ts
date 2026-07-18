import {
  apiPaths,
  type DeviceApproveInput,
  type DeviceLookupResponse,
  type GrantableProject,
} from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/** Device-login (browser auth for a local coding agent) data-access. Runs as
 *  the signed-in browser user. */
export const deviceApi = {
  lookup: (code: string) =>
    apiClient.get<DeviceLookupResponse>(
      `${apiPaths.auth.deviceLookup()}?code=${encodeURIComponent(code)}`,
    ),
  grantableProjects: () =>
    apiClient.get<GrantableProject[]>(apiPaths.auth.deviceProjects()),
  approve: (input: DeviceApproveInput) =>
    apiClient.post<void>(apiPaths.auth.deviceApprove(), input),
};
