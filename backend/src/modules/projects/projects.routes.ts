import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { discussionsRoutes } from '../discussions/discussions.routes';
import { projectsController } from './projects.controller';

export const projectsRoutes = Router();

// Every projects endpoint requires an authenticated request.
projectsRoutes.use(requireAuth);

// Project discussion channels + messages (nested; reads the parent `:id`).
projectsRoutes.use('/:id/channels', discussionsRoutes);

projectsRoutes.get('/', projectsController.list);
projectsRoutes.post('/', projectsController.create);
projectsRoutes.get('/:id', projectsController.getById);
projectsRoutes.patch('/:id', projectsController.update);
projectsRoutes.delete('/:id', projectsController.remove);

projectsRoutes.post('/:id/clients', projectsController.addClient);
projectsRoutes.delete('/:id/clients/:clientId', projectsController.removeClient);

projectsRoutes.post('/:id/members', projectsController.addMember);
projectsRoutes.delete('/:id/members/:memberId', projectsController.removeMember);

projectsRoutes.post('/:id/tasks', projectsController.addTask);
// Must precede the parameterised `:taskId` route so "reorder" isn't matched as an id.
projectsRoutes.patch('/:id/tasks/reorder', projectsController.reorderTasks);
projectsRoutes.patch('/:id/tasks/:taskId', projectsController.updateTask);
projectsRoutes.delete('/:id/tasks/:taskId', projectsController.removeTask);

projectsRoutes.post('/:id/tasks/:taskId/subtasks', projectsController.addSubtask);
projectsRoutes.patch(
  '/:id/tasks/:taskId/subtasks/:subtaskId',
  projectsController.updateSubtask,
);
projectsRoutes.delete(
  '/:id/tasks/:taskId/subtasks/:subtaskId',
  projectsController.removeSubtask,
);

projectsRoutes.post('/:id/tasks/:taskId/comments', projectsController.addComment);

projectsRoutes.post('/:id/milestones', projectsController.addMilestone);
projectsRoutes.patch(
  '/:id/milestones/:milestoneId',
  projectsController.toggleMilestone,
);
projectsRoutes.delete(
  '/:id/milestones/:milestoneId',
  projectsController.removeMilestone,
);
