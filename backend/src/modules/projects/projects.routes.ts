import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { projectsController } from './projects.controller';

export const projectsRoutes = Router();

// Every projects endpoint requires an authenticated request.
projectsRoutes.use(requireAuth);

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
projectsRoutes.patch('/:id/tasks/:taskId', projectsController.updateTask);
projectsRoutes.delete('/:id/tasks/:taskId', projectsController.removeTask);

projectsRoutes.post('/:id/milestones', projectsController.addMilestone);
projectsRoutes.patch(
  '/:id/milestones/:milestoneId',
  projectsController.toggleMilestone,
);
projectsRoutes.delete(
  '/:id/milestones/:milestoneId',
  projectsController.removeMilestone,
);
