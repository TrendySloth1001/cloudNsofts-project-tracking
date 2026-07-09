import { Router } from 'express';
import { requireProjectAbility } from '../auth/access';
import { docsController } from './docs.controller';

// Mounted under `/:id/docs` on the projects router; `mergeParams` exposes the
// parent `:id` (projectId). Auth + project-access (which resolves
// `req.projectRole`) are inherited from the projects router.
export const docsRoutes = Router({ mergeParams: true });

// Writing docs is a board edit (members/managers/admins + agents); viewers and
// clients read only.
const canEditDocs = requireProjectAbility('canEditBoard');

// Reads are open to anyone who can access the project (gate inherited above).
docsRoutes.get('/', docsController.listDocs);
docsRoutes.get('/:docId', docsController.getDoc);

docsRoutes.post('/', canEditDocs, docsController.createDoc);
docsRoutes.patch('/:docId', canEditDocs, docsController.updateDoc);
docsRoutes.delete('/:docId', canEditDocs, docsController.removeDoc);
