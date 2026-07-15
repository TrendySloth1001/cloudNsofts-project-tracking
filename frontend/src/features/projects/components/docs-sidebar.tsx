'use client';

import { useState } from 'react';
import {
  DOC_VISIBILITY_LABELS,
  type DocSummary,
  type DocVisibility,
} from '@cnsofts/shared';
import { Icon, IconButton, Spinner } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './project-docs.module.css';

export interface DocsSidebarProps {
  docs: DocSummary[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  /** Editors (member+) may create pages and drag them between sections. */
  canEdit: boolean;
  /** A client sees a single "Documents" list — no team section at all. Team
   *  roles (viewer+) see both the Team and Client review sections. */
  isClient: boolean;
  onCreate: (visibility: DocVisibility) => void;
  onReorder: (visibility: DocVisibility, orderedIds: string[]) => void;
  creating: boolean;
}

/** The two sections, in display order. Team-only first, client-shared second. */
const SECTIONS: DocVisibility[] = ['internal', 'client'];

interface DropTarget {
  visibility: DocVisibility;
  /** Insert before this doc id, or null to append to the section. */
  beforeId: string | null;
}

export function DocsSidebar({
  docs,
  activeId,
  loading,
  onSelect,
  canEdit,
  isClient,
  onCreate,
  onReorder,
  creating,
}: DocsSidebarProps) {
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const inSection = (v: DocVisibility): DocSummary[] =>
    docs
      .filter((d) => d.visibility === v)
      .sort((a, b) => a.position - b.position);

  function handleDrop(visibility: DocVisibility) {
    const docId = draggingId;
    const target = dropTarget ?? { visibility, beforeId: null };
    setDropTarget(null);
    setDraggingId(null);
    if (!docId) return;

    const columnIds = inSection(target.visibility)
      .map((d) => d.id)
      .filter((id) => id !== docId);
    const insertAt = target.beforeId
      ? columnIds.indexOf(target.beforeId)
      : columnIds.length;
    columnIds.splice(insertAt < 0 ? columnIds.length : insertAt, 0, docId);

    // Skip the round-trip if nothing actually moved within the same section.
    const currentIds = inSection(target.visibility).map((d) => d.id);
    const unchanged =
      currentIds.length === columnIds.length &&
      currentIds.every((id, i) => id === columnIds[i]);
    if (unchanged) return;

    onReorder(target.visibility, columnIds);
  }

  function renderItem(d: DocSummary, sectionDocs: DocSummary[], index: number) {
    const showLine =
      dropTarget?.visibility === d.visibility && dropTarget?.beforeId === d.id;
    return (
      <div
        key={d.id}
        onDragOver={
          canEdit
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > rect.top + rect.height / 2;
                setDropTarget({
                  visibility: d.visibility,
                  beforeId: after
                    ? (sectionDocs[index + 1]?.id ?? null)
                    : d.id,
                });
              }
            : undefined
        }
      >
        {showLine && <div className={styles.dropLine} />}
        <button
          type="button"
          draggable={canEdit}
          onDragStart={
            canEdit
              ? (e) => {
                  e.dataTransfer.setData('text/plain', d.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggingId(d.id);
                }
              : undefined
          }
          onDragEnd={canEdit ? () => setDraggingId(null) : undefined}
          className={cx(
            styles.docItem,
            d.id === activeId && styles.docItemActive,
            draggingId === d.id && styles.docItemDragging,
          )}
          onClick={() => onSelect(d.id)}
        >
          {canEdit && (
            <Icon
              name="gripVertical"
              size={14}
              className={styles.docDragHandle}
            />
          )}
          <Icon name="doc" size={15} className={styles.docItemIcon} />
          <span className={styles.docName}>{d.title}</span>
        </button>
      </div>
    );
  }

  function renderSection(v: DocVisibility) {
    const sectionDocs = inSection(v);
    const isDropCol = dropTarget?.visibility === v;
    return (
      <div key={v} className={styles.docSection}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            {DOC_VISIBILITY_LABELS[v]}
          </span>
          <span className={styles.sectionCount}>{sectionDocs.length}</span>
          {canEdit && (
            <IconButton
              icon="add"
              label={`New page in ${DOC_VISIBILITY_LABELS[v]}`}
              variant="ghost"
              size="sm"
              onClick={() => onCreate(v)}
              disabled={creating}
            />
          )}
        </div>
        <div
          className={cx(
            styles.sectionBody,
            isDropCol && canEdit && styles.sectionBodyDragOver,
          )}
          onDragOver={
            canEdit
              ? (e) => {
                  e.preventDefault();
                  setDropTarget((cur) =>
                    cur?.visibility === v && cur.beforeId !== null
                      ? cur
                      : { visibility: v, beforeId: null },
                  );
                }
              : undefined
          }
          onDragLeave={
            canEdit
              ? (e) => {
                  if (
                    !e.currentTarget.contains(e.relatedTarget as Node | null)
                  ) {
                    setDropTarget((cur) =>
                      cur?.visibility === v ? null : cur,
                    );
                  }
                }
              : undefined
          }
          onDrop={canEdit ? () => handleDrop(v) : undefined}
        >
          {sectionDocs.length === 0 ? (
            <span className={styles.sectionEmpty}>
              {v === 'client'
                ? canEdit
                  ? 'Drag a page here to share it with the client'
                  : 'Nothing shared yet'
                : 'No team pages yet'}
            </span>
          ) : (
            sectionDocs.map((d, i) => renderItem(d, sectionDocs, i))
          )}
        </div>
      </div>
    );
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHead}>
        <span className={styles.sidebarTitle}>
          {isClient ? 'Documents' : 'Docs'}
        </span>
      </div>

      <div className={styles.docList}>
        {loading && docs.length === 0 && (
          <div className={styles.sidebarState}>
            <Spinner size={18} />
          </div>
        )}

        {/* Client: a single flat list (the API only returns client docs). */}
        {!loading && isClient && docs.length === 0 && (
          <span className={styles.sidebarEmpty}>No documents yet</span>
        )}
        {isClient &&
          inSection('client').map((d, i) =>
            renderItem(d, inSection('client'), i),
          )}

        {/* Team roles: the two review sections. */}
        {!isClient && SECTIONS.map(renderSection)}
      </div>
    </aside>
  );
}
