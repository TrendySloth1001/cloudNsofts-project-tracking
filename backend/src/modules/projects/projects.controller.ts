import {
  addClientSchema,
  addMemberSchema,
  createCommentSchema,
  createFeatureSchema,
  createMilestoneSchema,
  createProjectSchema,
  createSubtaskSchema,
  createTaskSchema,
  reorderFeaturesSchema,
  reorderTasksSchema,
  updateFeatureSchema,
  updateMemberRoleSchema,
  updateProjectSchema,
  updateSubtaskSchema,
  updateTaskSchema,
} from '@cnsofts/shared';
import type { Request } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import { validate } from '../../shared/http/validate';
import { requireUser } from '../auth/access';
import { projectsService } from './projects.service';

/** Display name of the authenticated actor, for activity/comment attribution. */
function actorName(req: Request): string {
  return req.authUser?.name ?? 'Someone';
}

export const projectsController = {
  list: asyncHandler(async (req, res) => {
    res.json(await projectsService.list(requireUser(req)));
  }),
  create: asyncHandler(async (req, res) => {
    const input = validate(createProjectSchema, req.body);
    res.status(201).json(await projectsService.create(input, requireUser(req)));
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
  updateMember: asyncHandler(async (req, res) => {
    const input = validate(updateMemberRoleSchema, req.body);
    res.json(
      await projectsService.updateMemberRole(
        req.params.id,
        req.params.memberId,
        input.role,
      ),
    );
  }),
  removeMember: asyncHandler(async (req, res) => {
    res.json(
      await projectsService.removeMember(req.params.id, req.params.memberId),
    );
  }),

  /* ------------------------------- Features ----------------------------- */
  addFeature: asyncHandler(async (req, res) => {
    const input = validate(createFeatureSchema, req.body);
    res.status(201).json(await projectsService.addFeature(req.params.id, input));
  }),
  updateFeature: asyncHandler(async (req, res) => {
    const input = validate(updateFeatureSchema, req.body);
    res.json(
      await projectsService.updateFeature(
        req.params.id,
        req.params.featureId,
        input,
      ),
    );
  }),
  removeFeature: asyncHandler(async (req, res) => {
    res.json(
      await projectsService.removeFeature(req.params.id, req.params.featureId),
    );
  }),
  reorderFeatures: asyncHandler(async (req, res) => {
    const input = validate(reorderFeaturesSchema, req.body);
    res.json(await projectsService.reorderFeatures(req.params.id, input));
  }),

  addTask: asyncHandler(async (req, res) => {
    const input = validate(createTaskSchema, req.body);
    res.status(201).json(await projectsService.addTask(req.params.id, input));
  }),
  reorderTasks: asyncHandler(async (req, res) => {
    const input = validate(reorderTasksSchema, req.body);
    res.json(
      await projectsService.reorderTasks(req.params.id, input, actorName(req)),
    );
  }),
  updateTask: asyncHandler(async (req, res) => {
    const input = validate(updateTaskSchema, req.body);
    res.json(
      await projectsService.updateTask(
        req.params.id,
        req.params.taskId,
        input,
        actorName(req),
        req.agentName ?? null,
      ),
    );
  }),
  removeTask: asyncHandler(async (req, res) => {
    res.json(
      await projectsService.removeTask(req.params.id, req.params.taskId),
    );
  }),

  /* ------------------------------ Subtasks ------------------------------ */
  addSubtask: asyncHandler(async (req, res) => {
    const input = validate(createSubtaskSchema, req.body);
    res
      .status(201)
      .json(
        await projectsService.addSubtask(
          req.params.id,
          req.params.taskId,
          input,
        ),
      );
  }),
  updateSubtask: asyncHandler(async (req, res) => {
    const input = validate(updateSubtaskSchema, req.body);
    res.json(
      await projectsService.updateSubtask(
        req.params.id,
        req.params.taskId,
        req.params.subtaskId,
        input,
      ),
    );
  }),
  removeSubtask: asyncHandler(async (req, res) => {
    res.json(
      await projectsService.removeSubtask(
        req.params.id,
        req.params.taskId,
        req.params.subtaskId,
      ),
    );
  }),

  /* ------------------------------ Comments ------------------------------ */
  addComment: asyncHandler(async (req, res) => {
    const input = validate(createCommentSchema, req.body);
    res
      .status(201)
      .json(
        await projectsService.addComment(
          req.params.id,
          req.params.taskId,
          actorName(req),
          input,
          req.agentName ?? null,
        ),
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
