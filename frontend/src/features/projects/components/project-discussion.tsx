'use client';

import { useEffect, useState } from 'react';
import { Button, Icon, Spinner } from '@/components/ui';
import { cx } from '@/lib/cx';
import { useChannels } from '../use-discussions';
import { ChannelSidebar } from './channel-sidebar';
import { ChannelView } from './channel-view';
import { CreateChannelDialog } from './create-channel-dialog';
import type { ChannelCandidate } from './channel-members-dialog';
import styles from './project-discussion.module.css';

export interface ProjectDiscussionProps {
  projectId: string;
  /** Project members + clients an admin/manager can add to channels. */
  candidates: ChannelCandidate[];
  /** Caller may create/delete channels & manage rosters (admin/manager). */
  canManageChannels: boolean;
  /** Fired (mobile) when the chat detail opens/closes, so the parent can go
   *  full-screen by hiding the project header. */
  onChatDetailChange?: (open: boolean) => void;
}

/** A Slack-style discussion space scoped to the project: internal (team) and
 *  client-facing channels, each with its own message thread. On mobile it's a
 *  master-detail — the channel list, then the full chat on tap. */
export function ProjectDiscussion({
  projectId,
  candidates,
  canManageChannels,
  onChatDetailChange,
}: ProjectDiscussionProps) {
  const { channels, loading, reload, upsert, removeLocal } =
    useChannels(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Mobile only: whether the chat pane (vs. the channel list) is showing.
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  // Keep a valid channel selected as the list changes.
  useEffect(() => {
    if (channels.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (!activeId || !channels.some((c) => c.id === activeId)) {
      setActiveId(channels[0].id);
    }
  }, [channels, activeId]);

  // Let the parent hide the project header while the mobile chat is open.
  useEffect(() => {
    onChatDetailChange?.(mobileChatOpen);
  }, [mobileChatOpen, onChatDetailChange]);

  const active = channels.find((c) => c.id === activeId) ?? null;

  function openChannel(id: string) {
    setActiveId(id);
    setMobileChatOpen(true);
  }

  return (
    <div className={cx(styles.layout, mobileChatOpen && styles.mobileChat)}>
      <ChannelSidebar
        channels={channels}
        activeId={activeId}
        loading={loading}
        onSelect={openChannel}
        onCreate={() => setCreateOpen(true)}
        canCreate={canManageChannels}
      />

      <div className={styles.main}>
        {active ? (
          <ChannelView
            projectId={projectId}
            channel={active}
            candidates={candidates}
            canManageChannels={canManageChannels}
            onBack={() => setMobileChatOpen(false)}
            onDeleted={() => {
              removeLocal(active.id);
              setMobileChatOpen(false);
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
              <Icon name="chat" size={26} tone="brand" />
            </span>
            <p className={styles.emptyTitle}>No channels yet</p>
            <p className={styles.emptyText}>
              {canManageChannels
                ? 'Create a channel to start the discussion — keep it internal to the team, or share it with the client.'
                : 'No channels have been shared with you yet.'}
            </p>
            {canManageChannels && (
              <Button leftIcon="add" onClick={() => setCreateOpen(true)}>
                New channel
              </Button>
            )}
          </div>
        )}
      </div>

      <CreateChannelDialog
        projectId={projectId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(channel) => {
          setCreateOpen(false);
          upsert(channel);
          setActiveId(channel.id);
          setMobileChatOpen(true);
        }}
      />
    </div>
  );
}
