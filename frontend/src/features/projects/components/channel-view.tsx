'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CHANNEL_VISIBILITY_LABELS,
  type Channel,
} from '@cnsofts/shared';
import { Badge, IconButton, Spinner, useConfirm } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { discussionsApi } from '../discussions.api';
import { useChannelMessages } from '../use-discussions';
import { formatDateTime } from '../task-utils';
import styles from './project-discussion.module.css';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface ChannelViewProps {
  projectId: string;
  channel: Channel;
  onBack: () => void;
  onDeleted: () => void;
}

export function ChannelView({
  projectId,
  channel,
  onBack,
  onDeleted,
}: ChannelViewProps) {
  const { messages, loading, append } = useChannelMessages(projectId, channel.id);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const confirm = useConfirm();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function submitMessage() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const message = await discussionsApi.postMessage(projectId, channel.id, {
        body: text,
      });
      append(message);
      setBody('');
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
        <IconButton
          icon="delete"
          label={`Delete #${channel.name}`}
          variant="ghost"
          size="sm"
          onClick={() => void deleteChannel()}
        />
      </header>

      <div className={styles.messages} ref={listRef}>
        {loading && messages.length === 0 ? (
          <div className={styles.messagesState}>
            <Spinner size={22} />
          </div>
        ) : (
          <div className={styles.messagesInner}>
            <div className={styles.channelIntro}>
              <p className={styles.introTitle}>
                <span className={styles.channelHash}>#</span>
                {channel.name}
              </p>
              <p className={styles.introText}>
                This is the beginning of the #{channel.name} channel.
              </p>
            </div>
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const grouped =
                prev &&
                prev.author === m.author &&
                new Date(m.createdAt).getTime() -
                  new Date(prev.createdAt).getTime() <
                  GROUP_WINDOW_MS;
              if (grouped) {
                return (
                  <div key={m.id} className={styles.messageCont}>
                    <p className={styles.messageBody}>{m.body}</p>
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
                    <p className={styles.messageBody}>{m.body}</p>
                  </div>
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
        <div className={styles.composerBox}>
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
            icon="chevronRight"
            label="Send"
            variant={body.trim() ? 'primary' : 'subtle'}
            size="sm"
            type="submit"
            disabled={!body.trim() || sending}
          />
        </div>
      </form>
    </div>
  );
}
