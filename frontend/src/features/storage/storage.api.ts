import { apiPaths, type StorageAuditReport } from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/** Platform-admin storage reconciliation. Paths come from the shared contract. */
export const storageApi = {
  /** Dry-run: what images are orphaned (no deletions). */
  audit: () => apiClient.get<StorageAuditReport>(apiPaths.storage.audit()),

  /** Reclaim: delete every orphaned image + dangling object. */
  purge: () =>
    apiClient.post<StorageAuditReport>(apiPaths.storage.auditPurge(), {}),
};
