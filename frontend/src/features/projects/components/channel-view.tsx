'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  CHANNEL_VISIBILITY_LABELS,
  MESSAGE_BODY_MAX_LENGTH,
  type Channel,
  type MessageAttachment,
} from '@cnsofts/shared';
import {
  Badge,
  Icon,
  IconButton,
  Markdown,
  Spinner,
  useConfirm,
} from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { usePermissions } from '@/features/auth/use-permissions';
import { discussionsApi } from '../discussions.api';
import { ApiRequestError, fieldErrorMessage } from '@/lib/api-client';
import { useChannelMessages } from '../use-discussions';
import { useProject } from '../use-projects';
import { cx } from '@/lib/cx';
import { dayKey, formatDayLabel, formatTime } from '../task-utils';
import {
  ChannelMembersDialog,
  type ChannelCandidate,
} from './channel-members-dialog';
import {
  MessageComposer,
  type MessageComposerHandle,
} from './message-composer';
import { ScheduledMessagesDialog } from './scheduled-messages-dialog';
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
  const [sendError, setSendError] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const composerRef = useRef<MessageComposerHandle>(null);
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

  // Switching channels starts a fresh draft (the composer remounts via `key`).
  useEffect(() => {
    setBody('');
    setAttach(null);
  }, [channel.id]);

  async function submitMessage() {
    const text = body.trim();
    // Guard the empty and over-limit cases up front so a bad send never fires.
    if ((!text && !attach) || text.length > MESSAGE_BODY_MAX_LENGTH || sending)
      return;
    setSending(true);
    setSendError(null);
    try {
      const message = await discussionsApi.postMessage(projectId, channel.id, {
        body: text,
        attachment: attach?.ref ?? null,
      });
      append(message);
      setBody('');
      setAttach(null);
      composerRef.current?.clear();
    } catch (err) {
      // Surface the reason and keep the draft so nothing typed is lost.
      setSendError(
        fieldErrorMessage(err, 'body') ??
          (err instanceof ApiRequestError
            ? err.message
            : 'Could not send the message. Please try again.'),
      );
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
                <p className={styles.introText}>
                  This is the beginning of the{' '}
                  <span className={styles.introChannel}>#{channel.name}</span>{' '}
                  channel.
                </p>
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              // A new calendar day always starts a fresh block (with a divider
              // and the author's avatar), never a grouped continuation.
              const newDay =
                !prev || dayKey(m.createdAt) !== dayKey(prev.createdAt);
              const grouped =
                !newDay &&
                prev &&
                prev.author === m.author &&
                // An agent post and a human post from the same account sit on
                // opposite sides, so they must never group together.
                (prev.agentName ?? null) === (m.agentName ?? null) &&
                new Date(m.createdAt).getTime() -
                  new Date(prev.createdAt).getTime() <
                  GROUP_WINDOW_MS;
              const dayDivider = newDay ? (
                <div className={styles.dayDivider}>
                  <span className={styles.dayDividerLabel}>
                    {formatDayLabel(m.createdAt)}
                  </span>
                </div>
              ) : null;
              // My own messages align right (messenger-style); everyone else —
              // including my coding agent — sits on the left as a distinct
              // participant, so agent posts don't read as if I typed them.
              const isMine =
                !m.agentName &&
                !!m.authorEmail &&
                !!email &&
                m.authorEmail === email;
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
              const content = grouped ? (
                <div className={cx(styles.messageCont, isMine && styles.mine)}>
                  {m.body && (
                    <Markdown className={styles.messageBody}>{m.body}</Markdown>
                  )}
                  {attachmentCard}
                  {deleteBtn}
                </div>
              ) : (
                <div className={cx(styles.message, isMine && styles.mine)}>
                  <UserAvatar name={m.author} seed={m.author} size={34} />
                  <div className={styles.messageMain}>
                    <div className={styles.messageHead}>
                      {!isMine && (
                        <span className={styles.messageAuthor}>{m.author}</span>
                      )}
                      {m.agentName && (
                        <span className={styles.viaAgent}>
                          <Icon name="ai" size={10} />
                          {m.agentName}
                        </span>
                      )}
                      <span className={styles.messageTime}>
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                    {m.body && (
                    <Markdown className={styles.messageBody}>{m.body}</Markdown>
                  )}
                    {attachmentCard}
                  </div>
                  {deleteBtn}
                </div>
              );
              return (
                <Fragment key={m.id}>
                  {dayDivider}
                  {content}
                </Fragment>
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
        <MessageComposer
          key={channel.id}
          ref={composerRef}
          placeholder={`Message #${channel.name}`}
          disabled={sending}
          onChange={(value) => {
            setBody(value);
            if (sendError) setSendError(null);
          }}
          onSubmit={() => void submitMessage()}
          leftSlot={
            project ? (
              <IconButton
                icon="attachment"
                label="Attach a task or feature"
                variant="ghost"
                size="sm"
                onClick={() => setPickerOpen(true)}
              />
            ) : null
          }
          rightSlot={
            <>
              <IconButton
                icon="calendar"
                label="Schedule message"
                variant="ghost"
                size="sm"
                onClick={() => setScheduleOpen(true)}
              />
              <IconButton
                icon="send"
                label="Send"
                variant={body.trim() || attach ? 'primary' : 'subtle'}
                size="sm"
                type="submit"
                disabled={
                  (!body.trim() && !attach) ||
                  body.length > MESSAGE_BODY_MAX_LENGTH ||
                  sending
                }
              />
            </>
          }
        />
        {(sendError ||
          body.length > MESSAGE_BODY_MAX_LENGTH - 200) && (
          <div className={styles.composerFooter}>
            <span className={styles.composerError}>{sendError}</span>
            <span
              className={cx(
                styles.composerCount,
                body.length > MESSAGE_BODY_MAX_LENGTH &&
                  styles.composerCountOver,
              )}
            >
              {body.length.toLocaleString()}/
              {MESSAGE_BODY_MAX_LENGTH.toLocaleString()}
            </span>
          </div>
        )}
      </form>

      <ScheduledMessagesDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        projectId={projectId}
        channelId={channel.id}
        draft={{ body, attachment: attach?.ref ?? null }}
        onScheduled={() => {
          setBody('');
          setAttach(null);
          composerRef.current?.clear();
          setScheduleOpen(false);
        }}
      />

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
