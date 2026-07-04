'use client';

import {
  CHANNEL_VISIBILITY_LABELS,
  channelVisibilitySchema,
  type Channel,
  type ChannelVisibility,
} from '@cnsofts/shared';
import { Icon, IconButton, Spinner } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './project-discussion.module.css';

const GROUP_ICON: Record<ChannelVisibility, 'user' | 'userCircle'> = {
  internal: 'user',
  client: 'userCircle',
};
const GROUP_TONE: Record<ChannelVisibility, 'brand' | 'info'> = {
  internal: 'brand',
  client: 'info',
};

export interface ChannelSidebarProps {
  channels: Channel[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ChannelSidebar({
  channels,
  activeId,
  loading,
  onSelect,
  onCreate,
}: ChannelSidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHead}>
        <span className={styles.sidebarTitle}>Channels</span>
        <IconButton
          icon="add"
          label="New channel"
          variant="ghost"
          size="sm"
          onClick={onCreate}
        />
      </div>

      <div className={styles.channelList}>
        {loading && channels.length === 0 && (
          <div className={styles.sidebarState}>
            <Spinner size={18} />
          </div>
        )}
        {!loading && channels.length === 0 && (
          <span className={styles.sidebarEmpty}>No channels yet</span>
        )}

        {channelVisibilitySchema.options.map((vis) => {
          const items = channels.filter((c) => c.visibility === vis);
          if (items.length === 0) return null;
          return (
            <div key={vis} className={styles.channelGroup}>
              <div className={styles.groupLabel}>
                <Icon name={GROUP_ICON[vis]} size={12} tone={GROUP_TONE[vis]} />
                {CHANNEL_VISIBILITY_LABELS[vis]}
              </div>
              {items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={cx(
                    styles.channelItem,
                    c.id === activeId && styles.channelItemActive,
                  )}
                  onClick={() => onSelect(c.id)}
                >
                  <span className={styles.hash}>#</span>
                  <span className={styles.channelName}>{c.name}</span>
                  {c.messageCount > 0 && (
                    <span className={styles.channelCount}>{c.messageCount}</span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
