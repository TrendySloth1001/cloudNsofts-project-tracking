'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CHANNEL_VISIBILITY_LABELS,
  type Channel,
  type MessageAttachment,
} from '@cnsofts/shared';
import { Badge, Icon, IconButton, Spinner, useConfirm } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { usePermissions } from '@/features/auth/use-permissions';
import { discussionsApi } from '../discussions.api';
import { useChannelMessages } from '../use-discussions';
import { useProject } from '../use-projects';
import { formatDateTime } from '../task-utils';
import {
  ChannelMembersDialog,
  type ChannelCandidate,
} from './channel-members-dialog';
import { AttachPickerDialog } from './attach-picker-dialog';
import { MessageAttachmentCard } from './message-attachment-card';
import { TaskDetailDialog } from './task-detail-dialog';
import { FeatureDetailDialog } from './feature-detail-dialog';
import styles from './project-discussion.module.css';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface ChannelViewProps {
  projectId: string;
  channel: Channel;
  onBack: () => void;
  onDeleted: () => void;
  /** Project members + clients that an admin/manager can add to the channel. */
  candidates: ChannelCandidate[];
  /** Caller may create/delete channels & manage rosters (admin/manager). */
  canManageChannels: boolean;
}

export function ChannelView({
  projectId,
  channel,
  onBack,
  onDeleted,
  candidates,
  canManageChannels,
}: ChannelViewProps) {
  const { isAdmin, email } = usePermissions();
  const { project } = useProject(projectId);
  const { messages, loading, append, remove, loadOlder, hasMore, loadingOlder } =
    useChannelMessages(projectId, channel.id);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  // Composer attachment (a task/feature reference) + its display label.
  const [attach, setAttach] = useState<{
    ref: MessageAttachment;
    label: string;
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // In-place, read-only detail overlays opened from attachment cards — the chat
  // shows the card view, never an edit form.
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailFeatureId, setDetailFeatureId] = useState<string | null>(null);
  const confirm = useConfirm();
  const listRef = useRef<HTMLDivElement>(null);

  const canDeleteMessage = (authorEmail: string | null): boolean =>
    isAdmin || (!!authorEmail && !!email && authorEmail === email);

  async function deleteMessage(messageId: string) {
    remove(messageId); // optimistic; the WS message:deleted reconciles
    try {
      await discussionsApi.deleteMessage(projectId, channel.id, messageId);
    } catch {
      // ignore — a failed delete just means it stays until the next full load
    }
  }

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function submitMessage() {
    const text = body.trim();
    if ((!text && !attach) || sending) return;
    setSending(true);
    try {
      const message = await discussionsApi.postMessage(projectId, channel.id, {
        body: text,
        attachment: attach?.ref ?? null,
      });
      append(message);
      setBody('');
      setAttach(null);
    } finally {
      setSending(false);
    }
  }

  async function deleteChannel() {
    const ok = await confirm({
      title: 'Delete channel?',
      message: (
        <>
          Delete <strong>#{channel.name}</strong> and all its messages? This
          can’t be undone.
        </>
      ),
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await discussionsApi.removeChannel(projectId, channel.id);
    onDeleted();
  }

  return (
    <div className={styles.channel}>
      <header className={styles.channelHead}>
        <span className={styles.backBtn}>
          <IconButton
            icon="chevronLeft"
            label="Back to channels"
            variant="ghost"
            size="sm"
            onClick={onBack}
          />
        </span>
        <div className={styles.channelHeadMain}>
          <h2 className={styles.channelTitle}>
            <span className={styles.channelHash}>#</span>
            {channel.name}
          </h2>
          <Badge
            className={styles.channelBadge}
            variant={channel.visibility === 'internal' ? 'primary' : 'info'}
            size="sm"
          >
            {CHANNEL_VISIBILITY_LABELS[channel.visibility]}
          </Badge>
          {channel.description && (
            <span className={styles.channelDesc}>{channel.description}</span>
          )}
        </div>
        {canManageChannels && (
          <IconButton
            icon="user"
            label="Channel members"
            variant="ghost"
            size="sm"
            onClick={() => setMembersOpen(true)}
          />
        )}
        {canManageChannels && (
          <IconButton
            icon="delete"
            label={`Delete #${channel.name}`}
            variant="ghost"
            size="sm"
            onClick={() => void deleteChannel()}
          />
        )}
      </header>

      <div className={styles.messages} ref={listRef}>
        {loading && messages.length === 0 ? (
          <div className={styles.messagesState}>
            <Spinner size={22} />
          </div>
        ) : (
          <div className={styles.messagesInner}>
            {hasMore ? (
              <button
                type="button"
                className={styles.loadOlder}
                onClick={() => void loadOlder()}
                disabled={loadingOlder}
              >
                {loadingOlder ? 'Loading…' : 'Load earlier messages'}
              </button>
            ) : (
              <div className={styles.channelIntro}>
                <p className={styles.introTitle}>
                  <span className={styles.channelHash}>#</span>
                  {channel.name}
                </p>
                <p className={styles.introText}>
                  This is the beginning of the #{channel.name} channel.
                </p>
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const grouped =
                prev &&
                prev.author === m.author &&
                new Date(m.createdAt).getTime() -
                  new Date(prev.createdAt).getTime() <
                  GROUP_WINDOW_MS;
              const deletable = canDeleteMessage(m.authorEmail);
              const deleteBtn = deletable ? (
                <span className={styles.msgDelete}>
                  <IconButton
                    icon="delete"
                    label="Delete message"
                    variant="ghost"
                    size="sm"
                    onClick={() => void deleteMessage(m.id)}
                  />
                </span>
              ) : null;
              const attachmentCard = m.attachment ? (
                <MessageAttachmentCard
                  attachment={m.attachment}
                  project={project}
                  onOpenTask={(task) => setDetailTaskId(task.id)}
                  onOpenFeature={(feature) => setDetailFeatureId(feature.id)}
                />
              ) : null;
              if (grouped) {
                return (
                  <div key={m.id} className={styles.messageCont}>
                    {m.body && <p className={styles.messageBody}>{m.body}</p>}
                    {attachmentCard}
                    {deleteBtn}
                  </div>
                );
              }
              return (
                <div key={m.id} className={styles.message}>
                  <UserAvatar name={m.author} seed={m.author} size={34} />
                  <div className={styles.messageMain}>
                    <div className={styles.messageHead}>
                      <span className={styles.messageAuthor}>{m.author}</span>
                      <span className={styles.messageTime}>
                        {formatDateTime(m.createdAt)}
                      </span>
                    </div>
                    {m.body && <p className={styles.messageBody}>{m.body}</p>}
                    {attachmentCard}
                  </div>
                  {deleteBtn}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void submitMessage();
        }}
      >
        {attach && (
          <div className={styles.composerChip}>
            <Icon
              name={attach.ref.kind === 'feature' ? 'layers' : 'tasks'}
              size={14}
              tone={attach.ref.kind === 'feature' ? 'brand' : 'info'}
            />
            <span className={styles.composerChipLabel}>{attach.label}</span>
            <IconButton
              icon="close"
              label="Remove attachment"
              variant="ghost"
              size="sm"
              onClick={() => setAttach(null)}
            />
          </div>
        )}
        <div className={styles.composerBox}>
          {project && (
            <IconButton
              icon="attachment"
              label="Attach a task or feature"
              variant="ghost"
              size="sm"
              onClick={() => setPickerOpen(true)}
            />
          )}
          <textarea
            className={styles.composerInput}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Message #${channel.name}`}
            rows={1}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submitMessage();
              }
            }}
          />
          <IconButton
            icon="send"
            label="Send"
            variant={body.trim() || attach ? 'primary' : 'subtle'}
            size="sm"
            type="submit"
            disabled={(!body.trim() && !attach) || sending}
          />
        </div>
      </form>

      {canManageChannels && (
        <ChannelMembersDialog
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          projectId={projectId}
          channelId={channel.id}
          channelName={channel.name}
          candidates={candidates}
        />
      )}

      {project && (
        <>
          <AttachPickerDialog
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            project={project}
            onPick={(ref, label) => {
              setAttach({ ref, label });
              setPickerOpen(false);
            }}
          />
          {/* Attachment cards open a read-only detail right here in the
              discussion, so the conversation carries forward in the channel —
              editing stays on the board. */}
          <TaskDetailDialog
            open={detailTaskId !== null}
            onClose={() => setDetailTaskId(null)}
            projectId={projectId}
            task={project.tasks.find((t) => t.id === detailTaskId) ?? null}
            members={project.members}
            canEdit={false}
            onEdit={() => {}}
          />
          <FeatureDetailDialog
            open={detailFeatureId !== null}
            onClose={() => setDetailFeatureId(null)}
            project={project}
            feature={
              project.features.find((f) => f.id === detailFeatureId) ?? null
            }
          />
        </>
      )}
    </div>
  );
}
