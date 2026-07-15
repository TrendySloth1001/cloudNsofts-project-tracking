import {
  createDocSchema,
  reorderDocsSchema,
  updateDocSchema,
} from '@cnsofts/shared';
import { asyncHandler } from '../../shared/http/async-handler';
import { validate } from '../../shared/http/validate';
import { requireUser } from '../auth/access';
import { docsService } from './docs.service';

export const docsController = {
  // `req.projectRole` is set by the project-access gate; a client only sees the
  // `client` section (team roles see both).
  listDocs: asyncHandler(async (req, res) => {
    res.json(
      await docsService.listDocs(req.params.id, req.projectRole ?? null),
    );
  }),

  getDoc: asyncHandler(async (req, res) => {
    res.json(
      await docsService.getDoc(
        req.params.id,
        req.params.docId,
        req.projectRole ?? null,
      ),
    );
  }),

  reorderDocs: asyncHandler(async (req, res) => {
    const input = validate(reorderDocsSchema, req.body);
    res.json(await docsService.reorderDocs(req.params.id, input));
  }),

  createDoc: asyncHandler(async (req, res) => {
    const input = validate(createDocSchema, req.body);
    res
      .status(201)
      .json(
        await docsService.createDoc(
          req.params.id,
          requireUser(req),
          req.agentName ?? null,
          input,
        ),
      );
  }),

  updateDoc: asyncHandler(async (req, res) => {
    const input = validate(updateDocSchema, req.body);
    res.json(
      await docsService.updateDoc(
        req.params.id,
        req.params.docId,
        requireUser(req),
        req.agentName ?? null,
        input,
      ),
    );
  }),

  removeDoc: asyncHandler(async (req, res) => {
    await docsService.removeDoc(req.params.id, req.params.docId);
    res.status(204).end();
  }),
};
