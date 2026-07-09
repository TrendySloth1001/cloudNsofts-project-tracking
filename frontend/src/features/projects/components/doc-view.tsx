'use client';

import { useEffect, useState } from 'react';
import {
  DOC_BODY_MAX_LENGTH,
  DOC_TITLE_MAX_LENGTH,
  type Doc,
} from '@cnsofts/shared';
import {
  Button,
  Icon,
  IconButton,
  Markdown,
  Spinner,
  Tabs,
  useConfirm,
} from '@/components/ui';
import { cx } from '@/lib/cx';
import { ApiRequestError, fieldErrorMessage } from '@/lib/api-client';
import { formatDateTime } from '../task-utils';
import { docsApi } from '../docs.api';
import styles from './project-docs.module.css';

type EditPane = 'write' | 'preview';

export interface DocViewProps {
  projectId: string;
  docId: string;
  /** Caller may edit / delete this page. */
  canEdit: boolean;
  /** Open straight into edit mode (a page that was just created). */
  autoEdit: boolean;
  onBack: () => void;
  onSaved: (doc: Doc) => void;
  onDeleted: (docId: string) => void;
}

/** Reader + markdown editor for one documentation page. Loads the full body on
 *  selection, edits with a Write/Preview toggle, saves via the docs API. */
export function DocView({
  projectId,
  docId,
  canEdit,
  autoEdit,
  onBack,
  onSaved,
  onDeleted,
}: DocViewProps) {
  const confirm = useConfirm();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [pane, setPane] = useState<EditPane>('write');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the full doc (with body) whenever the selected page changes.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setEditing(false);
    setError(null);
    docsApi
      .getDoc(projectId, docId)
      .then((d) => {
        if (!alive) return;
        setDoc(d);
        setTitle(d.title);
        setBody(d.body);
        if (autoEdit) {
          setEditing(true);
          setPane('write');
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, docId, autoEdit]);

  function startEdit() {
    if (!doc) return;
    setTitle(doc.title);
    setBody(doc.body);
    setPane('write');
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    if (doc) {
      setTitle(doc.title);
      setBody(doc.body);
    }
    setEditing(false);
    setError(null);
  }

  async function save() {
    const trimmed = title.trim();
    if (
      !trimmed ||
      trimmed.length > DOC_TITLE_MAX_LENGTH ||
      body.length > DOC_BODY_MAX_LENGTH ||
      saving
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await docsApi.updateDoc(projectId, docId, {
        title: trimmed,
        body,
      });
      setDoc(updated);
      setTitle(updated.title);
      setBody(updated.body);
      setEditing(false);
      onSaved(updated);
    } catch (err) {
      setError(
        fieldErrorMessage(err, 'title') ??
          fieldErrorMessage(err, 'body') ??
          (err instanceof ApiRequestError
            ? err.message
            : 'Could not save the page.'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!doc) return;
    const ok = await confirm({
      title: 'Delete page?',
      message: (
        <>
          Delete <strong>“{doc.title}”</strong>? This can’t be undone.
        </>
      ),
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await docsApi.deleteDoc(projectId, docId);
    onDeleted(docId);
  }

  if (loading) {
    return (
      <div className={styles.docState}>
        <Spinner size={24} />
      </div>
    );
  }
  if (!doc) {
    return (
      <div className={styles.docState}>
        <p className={styles.emptyText}>This page could not be loaded.</p>
      </div>
    );
  }

  const titleOver = title.trim().length > DOC_TITLE_MAX_LENGTH;
  const bodyOver = body.length > DOC_BODY_MAX_LENGTH;

  return (
    <div className={styles.doc}>
      <div className={styles.docHead}>
        <IconButton
          className={styles.backBtn}
          icon="chevronLeft"
          label="Back to docs"
          variant="ghost"
          onClick={onBack}
        />
        {editing ? (
          <input
            className={styles.titleInput}
            value={title}
            maxLength={DOC_TITLE_MAX_LENGTH + 10}
            placeholder="Page title"
            onChange={(e) => setTitle(e.target.value)}
            autoFocus={autoEdit}
          />
        ) : (
          <div className={styles.docHeadMain}>
            <Icon name="doc" size={18} tone="brand" />
            <h2 className={styles.docTitle}>{doc.title}</h2>
          </div>
        )}

        <div className={styles.docActions}>
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={save}
                loading={saving}
                disabled={!title.trim() || titleOver || bodyOver}
              >
                Save
              </Button>
            </>
          ) : (
            canEdit && (
              <>
                <Button variant="outline" leftIcon="edit" onClick={startEdit}>
                  Edit
                </Button>
                <IconButton
                  icon="delete"
                  label="Delete page"
                  variant="ghost"
                  onClick={remove}
                />
              </>
            )
          )}
        </div>
      </div>

      {editing ? (
        <div className={styles.editor}>
          <Tabs
            className={styles.editorTabs}
            variant="pill"
            value={pane}
            onValueChange={(v) => setPane(v as EditPane)}
            items={[
              { value: 'write', label: 'Write', icon: 'edit' },
              { value: 'preview', label: 'Preview', icon: 'eye' },
            ]}
          />
          {pane === 'write' ? (
            <textarea
              className={styles.editorArea}
              value={body}
              placeholder="Write in markdown — # headings, **bold**, `code`, - lists, ```fenced code```…"
              onChange={(e) => setBody(e.target.value)}
            />
          ) : (
            <div className={styles.previewPane}>
              {body.trim() ? (
                <Markdown className={styles.body}>{body}</Markdown>
              ) : (
                <p className={styles.emptyText}>Nothing to preview yet.</p>
              )}
            </div>
          )}
          <div className={styles.editorFooter}>
            <span className={styles.editorError}>{error}</span>
            <span
              className={cx(
                styles.editorCount,
                bodyOver && styles.editorCountOver,
              )}
            >
              {body.length.toLocaleString()}/
              {DOC_BODY_MAX_LENGTH.toLocaleString()}
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.reader}>
          <div className={styles.docMeta}>
            <span>
              {doc.updatedBy
                ? `Edited by ${doc.updatedBy}`
                : `Created by ${doc.author}`}
            </span>
            {doc.agentName && (
              <span className={styles.viaAgent}>
                <Icon name="ai" size={11} /> via {doc.agentName}
              </span>
            )}
            <span className={styles.docMetaTime}>
              {formatDateTime(doc.updatedAt)}
            </span>
          </div>
          {doc.body.trim() ? (
            <Markdown className={styles.body}>{doc.body}</Markdown>
          ) : (
            <div className={styles.docEmpty}>
              <p className={styles.emptyText}>
                This page is empty.
                {canEdit ? ' Click Edit to write something.' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
