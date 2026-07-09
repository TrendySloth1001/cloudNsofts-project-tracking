import {
  apiPaths,
  type CreateDocInput,
  type Doc,
  type DocSummary,
  type UpdateDocInput,
} from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/** Typed data-access for a project's documentation pages. */
export const docsApi = {
  listDocs: (projectId: string) =>
    apiClient.get<DocSummary[]>(apiPaths.projects.docs(projectId)),
  getDoc: (projectId: string, docId: string) =>
    apiClient.get<Doc>(apiPaths.projects.doc(projectId, docId)),
  createDoc: (projectId: string, input: CreateDocInput) =>
    apiClient.post<Doc>(apiPaths.projects.docs(projectId), input),
  updateDoc: (projectId: string, docId: string, input: UpdateDocInput) =>
    apiClient.patch<Doc>(apiPaths.projects.doc(projectId, docId), input),
  deleteDoc: (projectId: string, docId: string) =>
    apiClient.delete<void>(apiPaths.projects.doc(projectId, docId)),
};
