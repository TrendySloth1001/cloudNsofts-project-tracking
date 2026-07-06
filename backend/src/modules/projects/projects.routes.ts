import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import {
  requireProjectAbility,
  requireProjectAccess,
  requireRole,
} from '../auth/access';
import { discussionsRoutes } from '../discussions/discussions.routes';
import { discussionsController } from '../discussions/discussions.controller';
import { projectsController } from './projects.controller';

export const projectsRoutes = Router();

// Every projects endpoint requires an authenticated request.
projectsRoutes.use(requireAuth);

// Anything under `/:id` first passes the project-access gate (which also
// resolves the caller's per-project role onto `req.projectRole`).
projectsRoutes.use('/:id', requireProjectAccess);

// Per-project ability gates (viewer/member/manager/admin — see the shared
// `projectAbilities` matrix). `requireProjectAccess` runs first.
const canEditBoard = requireProjectAbility('canEditBoard');
const canManageTeam = requireProjectAbility('canManageTeam');
const canEditProject = requireProjectAbility('canEditProject');
const canDeleteProject = requireProjectAbility('canDeleteProject');

// Project discussion channels + messages (nested; reads the parent `:id`).
projectsRoutes.use('/:id/channels', discussionsRoutes);

// Full-text search across the project's conversations (messages + task threads)
// so agents find context instead of ingesting whole threads. Read-only.
projectsRoutes.get('/:id/search', discussionsController.searchConversations);

projectsRoutes.get('/', projectsController.list);
// Creating a *new* project is a global-admin action (no project context yet).
projectsRoutes.post('/', requireRole('ADMIN'), projectsController.create);
projectsRoutes.get('/:id', projectsController.getById);
projectsRoutes.patch('/:id', canEditProject, projectsController.update);
projectsRoutes.delete('/:id', canDeleteProject, projectsController.remove);

// Team & client management: managers + admins.
projectsRoutes.post('/:id/clients', canManageTeam, projectsController.addClient);
projectsRoutes.delete(
  '/:id/clients/:clientId',
  canManageTeam,
  projectsController.removeClient,
);
projectsRoutes.post('/:id/members', canManageTeam, projectsController.addMember);
projectsRoutes.patch(
  '/:id/members/:memberId',
  canManageTeam,
  projectsController.updateMember,
);
projectsRoutes.delete(
  '/:id/members/:memberId',
  canManageTeam,
  projectsController.removeMember,
);

// Features (parents of tasks). Managing them is a board edit.
projectsRoutes.post('/:id/features', canEditBoard, projectsController.addFeature);
// Must precede the parameterised `:featureId` route so "reorder" isn't matched as an id.
projectsRoutes.patch(
  '/:id/features/reorder',
  canEditBoard,
  projectsController.reorderFeatures,
);
projectsRoutes.patch(
  '/:id/features/:featureId',
  canEditBoard,
  projectsController.updateFeature,
);
projectsRoutes.delete(
  '/:id/features/:featureId',
  canEditBoard,
  projectsController.removeFeature,
);

// Board writes require an editor role (viewer & client are read-only).
projectsRoutes.post('/:id/tasks', canEditBoard, projectsController.addTask);
// Must precede the parameterised `:taskId` route so "reorder" isn't matched as an id.
projectsRoutes.patch(
  '/:id/tasks/reorder',
  canEditBoard,
  projectsController.reorderTasks,
);
projectsRoutes.patch('/:id/tasks/:taskId', canEditBoard, projectsController.updateTask);
projectsRoutes.delete(
  '/:id/tasks/:taskId',
  canEditBoard,
  projectsController.removeTask,
);

projectsRoutes.post(
  '/:id/tasks/:taskId/subtasks',
  canEditBoard,
  projectsController.addSubtask,
);
projectsRoutes.patch(
  '/:id/tasks/:taskId/subtasks/:subtaskId',
  canEditBoard,
  projectsController.updateSubtask,
);
projectsRoutes.delete(
  '/:id/tasks/:taskId/subtasks/:subtaskId',
  canEditBoard,
  projectsController.removeSubtask,
);

projectsRoutes.post(
  '/:id/tasks/:taskId/comments',
  canEditBoard,
  projectsController.addComment,
);

projectsRoutes.post('/:id/milestones', canEditBoard, projectsController.addMilestone);
projectsRoutes.patch(
  '/:id/milestones/:milestoneId',
  canEditBoard,
  projectsController.toggleMilestone,
);
projectsRoutes.delete(
  '/:id/milestones/:milestoneId',
  canEditBoard,
  projectsController.removeMilestone,
);
