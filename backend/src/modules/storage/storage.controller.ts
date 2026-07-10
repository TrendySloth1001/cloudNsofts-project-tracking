import { asyncHandler } from '../../shared/http/async-handler';
import { storageService } from './storage.service';

export const storageController = {
  // Dry-run reconciliation report (no deletions).
  audit: asyncHandler(async (_req, res) => {
    res.json(await storageService.audit(false));
  }),

  // Reconcile AND delete the orphaned objects/rows.
  auditPurge: asyncHandler(async (_req, res) => {
    res.json(await storageService.audit(true));
  }),
};
