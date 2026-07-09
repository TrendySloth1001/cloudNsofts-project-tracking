import type {
  AuthUser,
  CreateDocInput,
  Doc,
  DocSummary,
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
  position: number;
  author: string;
  updatedBy: string | null;
  agentName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDoc(d: DocRow): Doc {
  return {
    id: d.id,
    projectId: d.projectId,
    title: d.title,
    body: d.body,
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

/** Load a doc, 404 unless it exists and belongs to the given project. */
async function loadDoc(projectId: string, docId: string): Promise<DocRow> {
  const doc = await prisma.doc.findFirst({ where: { id: docId, projectId } });
  if (!doc) throw HttpError.notFound('Doc not found');
  return doc;
}

export const docsService = {
  /** Sidebar listing — metadata only (bodies can be large). */
  async listDocs(projectId: string): Promise<DocSummary[]> {
    await ensureProject(projectId);
    const docs = await prisma.doc.findMany({
      where: { projectId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        projectId: true,
        title: true,
        position: true,
        updatedBy: true,
        agentName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return docs.map(toDocSummary);
  },

  /** One doc with its full markdown body. */
  async getDoc(projectId: string, docId: string): Promise<Doc> {
    return toDoc(await loadDoc(projectId, docId));
  },

  async createDoc(
    projectId: string,
    user: AuthUser,
    agentName: string | null,
    input: CreateDocInput,
  ): Promise<Doc> {
    await ensureProject(projectId);
    // Append to the end of the sidebar.
    const position = await prisma.doc.count({ where: { projectId } });
    const created = await prisma.doc.create({
      data: {
        projectId,
        title: input.title,
        body: input.body,
        position,
        author: user.name,
        authorEmail: user.email,
        agentName,
      },
    });
    return toDoc(created);
  },

  async updateDoc(
    projectId: string,
    docId: string,
    user: AuthUser,
    agentName: string | null,
    input: UpdateDocInput,
  ): Promise<Doc> {
    await loadDoc(projectId, docId);
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
    await loadDoc(projectId, docId);
    await prisma.doc.delete({ where: { id: docId } });
  },
};
