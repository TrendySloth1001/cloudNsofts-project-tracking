'use client';

import { useEffect, useState } from 'react';
import { Button, Icon, Spinner } from '@/components/ui';
import { cx } from '@/lib/cx';
import { useDocs } from '../use-docs';
import { docsApi } from '../docs.api';
import { DocsSidebar } from './docs-sidebar';
import { DocView } from './doc-view';
import styles from './project-docs.module.css';

export interface ProjectDocsProps {
  projectId: string;
  /** Caller may create / edit / delete docs (members, managers, admins). */
  canEdit: boolean;
  /** Fired (mobile) when a page is opened/closed, so the parent can go
   *  full-screen by hiding the project header. */
  onDetailChange?: (open: boolean) => void;
}

/** A per-project documentation space: a sidebar of markdown pages and a
 *  reader/editor. Team members and coding agents write here to keep everyone
 *  aware of what's going on. On mobile it's a master-detail (list, then page). */
export function ProjectDocs({
  projectId,
  canEdit,
  onDetailChange,
}: ProjectDocsProps) {
  const { docs, loading, reload, upsert, removeLocal } = useDocs(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Id of a freshly-created page so the viewer opens straight in edit mode.
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Keep a valid page selected as the list changes.
  useEffect(() => {
    if (docs.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (!activeId || !docs.some((d) => d.id === activeId)) {
      setActiveId(docs[0].id);
    }
  }, [docs, activeId]);

  useEffect(() => {
    onDetailChange?.(mobileOpen);
  }, [mobileOpen, onDetailChange]);

  const active = docs.find((d) => d.id === activeId) ?? null;

  function openDoc(id: string) {
    setActiveId(id);
    setMobileOpen(true);
  }

  async function createDoc() {
    if (creating) return;
    setCreating(true);
    try {
      const doc = await docsApi.createDoc(projectId, {
        title: 'Untitled page',
        body: '',
      });
      upsert(doc);
      setActiveId(doc.id);
      setAutoEditId(doc.id);
      setMobileOpen(true);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={cx(styles.layout, mobileOpen && styles.mobileOpen)}>
      <DocsSidebar
        docs={docs}
        activeId={activeId}
        loading={loading}
        onSelect={openDoc}
        onCreate={createDoc}
        canCreate={canEdit}
        creating={creating}
      />

      <div className={styles.main}>
        {active ? (
          <DocView
            key={active.id}
            projectId={projectId}
            docId={active.id}
            canEdit={canEdit}
            autoEdit={active.id === autoEditId}
            onBack={() => setMobileOpen(false)}
            onSaved={(doc) => {
              upsert(doc);
              setAutoEditId(null);
            }}
            onDeleted={(id) => {
              removeLocal(id);
              setMobileOpen(false);
              void reload();
            }}
          />
        ) : loading ? (
          <div className={styles.mainState}>
            <Spinner size={24} />
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>
              <Icon name="docs" size={26} tone="brand" />
            </span>
            <p className={styles.emptyTitle}>No docs yet</p>
            <p className={styles.emptyText}>
              {canEdit
                ? 'Create a page to document the project — architecture, onboarding, decisions, a running overview. Your coding agents can read and write these too.'
                : 'No documentation has been added to this project yet.'}
            </p>
            {canEdit && (
              <Button leftIcon="add" onClick={createDoc} disabled={creating}>
                New page
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
