'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DOC_BODY_MAX_LENGTH,
  DOC_TITLE_MAX_LENGTH,
  IMAGE_ALLOWED_MIME,
  type Doc,
} from '@cnsofts/shared';
import {
  Button,
  Icon,
  type IconName,
  IconButton,
  ImageLightbox,
  type LightboxImage,
  Markdown,
  Spinner,
  Tabs,
  Tooltip,
  useConfirm,
} from '@/components/ui';
import { cx } from '@/lib/cx';
import { extractMarkdownImages } from '@/lib/markdown-images';
import { ApiRequestError, fieldErrorMessage } from '@/lib/api-client';
import { formatDateTime } from '../task-utils';
import { docsApi } from '../docs.api';
import { imagesApi } from '../images.api';
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
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<{
    images: LightboxImage[];
    index: number;
  } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Images embedded in the saved page (reader) and in the live draft (preview).
  const readerImages = useMemo(
    () => (doc ? extractMarkdownImages(doc.body) : []),
    [doc],
  );
  const previewImages = useMemo(() => extractMarkdownImages(body), [body]);

  function openLightbox(images: LightboxImage[], src: string) {
    const i = images.findIndex((im) => im.src === src);
    setLightbox({ images, index: i < 0 ? 0 : i });
  }

  // Restore focus + caret after a body edit that React re-renders.
  function restoreCaret(pos: number) {
    requestAnimationFrame(() => {
      const ta = bodyRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  /** Set the current line to an H1–H3 heading (replacing any existing marker). */
  function setHeading(level: number) {
    const ta = bodyRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const lineStart = body.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = body.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = body.length;
    const line = body.slice(lineStart, lineEnd);
    const stripped = line.replace(/^#{1,6}\s+/, '');
    const nextLine = `${'#'.repeat(level)} ${stripped}`;
    setBody(body.slice(0, lineStart) + nextLine + body.slice(lineEnd));
    restoreCaret(pos + (nextLine.length - line.length));
  }

  /** Wrap the selection (or a placeholder) in a marker, e.g. ** for bold. */
  function wrapSelection(marker: string, placeholder: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = body.slice(s, e) || placeholder;
    const inserted = `${marker}${selected}${marker}`;
    setBody(body.slice(0, s) + inserted + body.slice(e));
    restoreCaret(s + marker.length + selected.length);
  }

  /** Prefix the current line (e.g. "- " for a bullet). */
  function prefixLine(prefix: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const lineStart = body.lastIndexOf('\n', pos - 1) + 1;
    setBody(body.slice(0, lineStart) + prefix + body.slice(lineStart));
    restoreCaret(pos + prefix.length);
  }

  /** Insert text at the caret (used after an image upload). */
  function insertAtCaret(text: string) {
    const ta = bodyRef.current;
    const s = ta ? ta.selectionStart : body.length;
    const e = ta ? ta.selectionEnd : body.length;
    setBody(body.slice(0, s) + text + body.slice(e));
    restoreCaret(s + text.length);
  }

  /** Wrap the selection in a fenced code block. */
  function insertCodeBlock() {
    const ta = bodyRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = body.slice(s, e) || 'code';
    const inserted = `\n\`\`\`\n${selected}\n\`\`\`\n`;
    setBody(body.slice(0, s) + inserted + body.slice(e));
    restoreCaret(s + 5 + selected.length);
  }

  /** Insert a markdown link around the selection, caret on the URL. */
  function insertLink() {
    const ta = bodyRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = body.slice(s, e) || 'text';
    const inserted = `[${selected}](url)`;
    setBody(body.slice(0, s) + inserted + body.slice(e));
    // Caret on "url" so the user can type/paste the address.
    restoreCaret(s + selected.length + 3);
  }

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const image = await imagesApi.upload(projectId, file);
      const alt = file.name.replace(/\.[^.]+$/, '') || 'image';
      insertAtCaret(`\n![${alt}](${image.url})\n`);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Image upload failed.',
      );
    } finally {
      setUploading(false);
    }
  }

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
          {!editing && readerImages.length > 0 && (
            <Button
              variant="outline"
              leftIcon="image"
              onClick={() => setLightbox({ images: readerImages, index: 0 })}
            >
              Images
              <span className={styles.imageCount}>{readerImages.length}</span>
            </Button>
          )}
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
            <div className={styles.writePane}>
              <div className={styles.formatBar}>
                <Tooltip content="Heading 1">
                  <button
                    type="button"
                    className={styles.formatText}
                    onClick={() => setHeading(1)}
                  >
                    H1
                  </button>
                </Tooltip>
                <Tooltip content="Heading 2">
                  <button
                    type="button"
                    className={styles.formatText}
                    onClick={() => setHeading(2)}
                  >
                    H2
                  </button>
                </Tooltip>
                <Tooltip content="Heading 3">
                  <button
                    type="button"
                    className={styles.formatText}
                    onClick={() => setHeading(3)}
                  >
                    H3
                  </button>
                </Tooltip>
                <span className={styles.formatDivider} />
                <FormatIcon
                  icon="bold"
                  label="Bold"
                  onClick={() => wrapSelection('**', 'bold text')}
                />
                <FormatIcon
                  icon="italic"
                  label="Italic"
                  onClick={() => wrapSelection('_', 'italic text')}
                />
                <FormatIcon
                  icon="strikethrough"
                  label="Strikethrough"
                  onClick={() => wrapSelection('~~', 'struck through')}
                />
                <span className={styles.formatDivider} />
                <FormatIcon
                  icon="code"
                  label="Inline code"
                  onClick={() => wrapSelection('`', 'code')}
                />
                <FormatIcon
                  icon="codeBlock"
                  label="Code block"
                  onClick={insertCodeBlock}
                />
                <span className={styles.formatDivider} />
                <FormatIcon
                  icon="listBullet"
                  label="Bulleted list"
                  onClick={() => prefixLine('- ')}
                />
                <FormatIcon
                  icon="quote"
                  label="Quote"
                  onClick={() => prefixLine('> ')}
                />
                <FormatIcon icon="link" label="Link" onClick={insertLink} />
                <span className={styles.formatDivider} />
                <FormatIcon
                  icon="image"
                  label={uploading ? 'Uploading…' : 'Insert image'}
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept={IMAGE_ALLOWED_MIME.join(',')}
                  hidden
                  onChange={onPickImage}
                />
              </div>
              <textarea
                ref={bodyRef}
                className={styles.editorArea}
                value={body}
                placeholder="Write in markdown — # headings, **bold**, `code`, - lists, ```fenced code```…"
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          ) : (
            <div className={styles.previewPane}>
              {body.trim() ? (
                <Markdown
                  className={styles.body}
                  onImageClick={(src) => openLightbox(previewImages, src)}
                >
                  {body}
                </Markdown>
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
            <Markdown
              className={styles.body}
              onImageClick={(src) => openLightbox(readerImages, src)}
            >
              {doc.body}
            </Markdown>
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

      <ImageLightbox
        images={lightbox?.images ?? []}
        index={lightbox?.index ?? null}
        onClose={() => setLightbox(null)}
        onIndexChange={(index) =>
          setLightbox((lb) => (lb ? { ...lb, index } : lb))
        }
      />
    </div>
  );
}

/** A single icon button in the docs formatting toolbar. */
function FormatIcon({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        className={styles.formatBtn}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        <Icon name={icon} size={16} />
      </button>
    </Tooltip>
  );
}
