import type {
  AuthUser,
  CreateDocInput,
  Doc,
  DocSummary,
  DocVisibility,
  ProjectRole,
  ReorderDocsInput,
  UpdateDocInput,
} from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';

/** The Prisma `Doc` row shape we map from (all scalar columns). */
type DocRow = {
  id: string;
  projectId: string;
  title: string;
  body: string;
  visibility: DocVisibility;
  position: number;
  author: string;
  updatedBy: string | null;
  agentName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A `client`-role caller only ever sees docs shared with clients; every team
 *  role (viewer/member/manager/admin) sees both sections. Returns the Prisma
 *  `where` fragment scoping a query to what the caller may read. */
function visibilityScope(role: ProjectRole | null): { visibility?: DocVisibility } {
  return role === 'client' ? { visibility: 'client' } : {};
}

function toDoc(d: DocRow): Doc {
  return {
    id: d.id,
    projectId: d.projectId,
    title: d.title,
    body: d.body,
    visibility: d.visibility,
    position: d.position,
    author: d.author,
    updatedBy: d.updatedBy,
    agentName: d.agentName,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

function toDocSummary(d: Omit<DocRow, 'body' | 'author'>): DocSummary {
  return {
    id: d.id,
    title: d.title,
    visibility: d.visibility,
    position: d.position,
    updatedBy: d.updatedBy,
    agentName: d.agentName,
    updatedAt: d.updatedAt.toISOString(),
  };
}

async function ensureProject(projectId: string): Promise<void> {
  if ((await prisma.project.count({ where: { id: projectId } })) === 0) {
    throw HttpError.notFound('Project not found');
  }
}

/** Load a doc, 404 unless it exists, belongs to the project, and the caller's
 *  role may see its section (a client can't load a team-only doc). Not-visible
 *  reads as not-found so nothing about internal docs leaks to a client. */
async function loadDoc(
  projectId: string,
  docId: string,
  role: ProjectRole | null,
): Promise<DocRow> {
  const doc = await prisma.doc.findFirst({
    where: { id: docId, projectId, ...visibilityScope(role) },
  });
  if (!doc) throw HttpError.notFound('Doc not found');
  return doc;
}

export const docsService = {
  /** Sidebar listing — metadata only (bodies can be large). Clients only see
   *  the `client` section; team roles see both. */
  async listDocs(
    projectId: string,
    role: ProjectRole | null,
  ): Promise<DocSummary[]> {
    await ensureProject(projectId);
    const docs = await prisma.doc.findMany({
      where: { projectId, ...visibilityScope(role) },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        projectId: true,
        title: true,
        visibility: true,
        position: true,
        updatedBy: true,
        agentName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return docs.map(toDocSummary);
  },

  /** One doc with its full markdown body (role-scoped: 404 for a client on a
   *  team-only doc). */
  async getDoc(
    projectId: string,
    docId: string,
    role: ProjectRole | null,
  ): Promise<Doc> {
    return toDoc(await loadDoc(projectId, docId, role));
  },

  async createDoc(
    projectId: string,
    user: AuthUser,
    agentName: string | null,
    input: CreateDocInput,
  ): Promise<Doc> {
    await ensureProject(projectId);
    // Append to the end of its section.
    const position = await prisma.doc.count({
      where: { projectId, visibility: input.visibility },
    });
    const created = await prisma.doc.create({
      data: {
        projectId,
        title: input.title,
        body: input.body,
        visibility: input.visibility,
        position,
        author: user.name,
        authorEmail: user.email,
        agentName,
      },
    });
    return toDoc(created);
  },

  /** Persist a drag-and-drop: every id in `orderedIds` is set to the target
   *  `visibility` (its section) and its list index (its order). Moving a doc
   *  into the `client` section is what shares it with clients. Only ids that
   *  actually belong to the project are touched. */
  async reorderDocs(
    projectId: string,
    input: ReorderDocsInput,
  ): Promise<DocSummary[]> {
    await ensureProject(projectId);
    await prisma.$transaction(async (tx) => {
      for (const [index, docId] of input.orderedIds.entries()) {
        await tx.doc.updateMany({
          where: { id: docId, projectId },
          data: { visibility: input.visibility, position: index },
        });
      }
    });
    // Return the full (team) listing so the mover sees both sections refreshed.
    return this.listDocs(projectId, null);
  },

  async updateDoc(
    projectId: string,
    docId: string,
    user: AuthUser,
    agentName: string | null,
    input: UpdateDocInput,
  ): Promise<Doc> {
    // Reached only by team roles (canEditBoard); team scope sees every section.
    await loadDoc(projectId, docId, null);
    const updated = await prisma.doc.update({
      where: { id: docId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        updatedBy: user.name,
        updatedByEmail: user.email,
        agentName,
      },
    });
    return toDoc(updated);
  },

  async removeDoc(
    projectId: string,
    docId: string,
  ): Promise<void> {
    await loadDoc(projectId, docId, null);
    await prisma.doc.delete({ where: { id: docId } });
  },
};
