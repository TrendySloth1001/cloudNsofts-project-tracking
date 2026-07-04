import {
  addClientSchema,
  addMemberSchema,
  createMilestoneSchema,
  createProjectSchema,
  createTaskSchema,
  reorderTasksSchema,
  updateProjectSchema,
  updateTaskSchema,
} from '@cnsofts/shared';
import { asyncHandler } from '../../shared/http/async-handler';
import { validate } from '../../shared/http/validate';
import { projectsService } from './projects.service';

export const projectsController = {
  list: asyncHandler(async (_req, res) => {
    res.json(await projectsService.list());
  }),
  create: asyncHandler(async (req, res) => {
    const input = validate(createProjectSchema, req.body);
    res.status(201).json(await projectsService.create(input));
  }),
  getById: asyncHandler(async (req, res) => {
    res.json(await projectsService.getById(req.params.id));
  }),
  update: asyncHandler(async (req, res) => {
    const input = validate(updateProjectSchema, req.body);
    res.json(await projectsService.update(req.params.id, input));
  }),
  remove: asyncHandler(async (req, res) => {
    await projectsService.remove(req.params.id);
    res.status(204).end();
  }),

  addClient: asyncHandler(async (req, res) => {
    const input = validate(addClientSchema, req.body);
    res.status(201).json(await projectsService.addClient(req.params.id, input));
  }),
  removeClient: asyncHandler(async (req, res) => {
    res.json(
      await projectsService.removeClient(req.params.id, req.params.clientId),
    );
  }),

  addMember: asyncHandler(async (req, res) => {
    const input = validate(addMemberSchema, req.body);
    res.status(201).json(await projectsService.addMember(req.params.id, input));
  }),
  removeMember: asyncHandler(async (req, res) => {
    res.json(
      await projectsService.removeMember(req.params.id, req.params.memberId),
    );
  }),

  addTask: asyncHandler(async (req, res) => {
    const input = validate(createTaskSchema, req.body);
    res.status(201).json(await projectsService.addTask(req.params.id, input));
  }),
  reorderTasks: asyncHandler(async (req, res) => {
    const input = validate(reorderTasksSchema, req.body);
    res.json(await projectsService.reorderTasks(req.params.id, input));
  }),
  updateTask: asyncHandler(async (req, res) => {
    const input = validate(updateTaskSchema, req.body);
    res.json(
      await projectsService.updateTask(req.params.id, req.params.taskId, input),
    );
  }),
  removeTask: asyncHandler(async (req, res) => {
    res.json(
      await projectsService.removeTask(req.params.id, req.params.taskId),
    );
  }),

  addMilestone: asyncHandler(async (req, res) => {
    const input = validate(createMilestoneSchema, req.body);
    res
      .status(201)
      .json(await projectsService.addMilestone(req.params.id, input));
  }),
  toggleMilestone: asyncHandler(async (req, res) => {
    res.json(
      await projectsService.toggleMilestone(
        req.params.id,
        req.params.milestoneId,
      ),
    );
  }),
  removeMilestone: asyncHandler(async (req, res) => {
    res.json(
      await projectsService.removeMilestone(
        req.params.id,
        req.params.milestoneId,
      ),
    );
  }),
};
