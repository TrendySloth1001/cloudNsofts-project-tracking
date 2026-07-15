'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Doc, DocSummary } from '@cnsofts/shared';
import { docsApi } from './docs.api';

/** Fold a full doc into a lightweight sidebar summary. */
function toSummary(doc: Doc): DocSummary {
  return {
    id: doc.id,
    title: doc.title,
    visibility: doc.visibility,
    position: doc.position,
    updatedBy: doc.updatedBy,
    agentName: doc.agentName,
    updatedAt: doc.updatedAt,
  };
}

/** A project's doc pages (metadata only), with local upsert/remove so the
 *  sidebar stays in sync without a full refetch after mutations. */
export function useDocs(projectId: string) {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setDocs(await docsApi.listDocs(projectId));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upsert = useCallback((doc: Doc) => {
    const summary = toSummary(doc);
    setDocs((prev) =>
      prev.some((d) => d.id === summary.id)
        ? prev.map((d) => (d.id === summary.id ? summary : d))
        : [...prev, summary],
    );
  }, []);

  const removeLocal = useCallback((docId: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  /** Replace the whole list (used after a drag-and-drop reorder response). */
  const replaceAll = useCallback((next: DocSummary[]) => {
    setDocs(next);
  }, []);

  return { docs, loading, reload, upsert, removeLocal, replaceAll };
}
