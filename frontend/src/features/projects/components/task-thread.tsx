'use client';

import { useState } from 'react';
import type { TaskEvent } from '@cnsofts/shared';
import { Button, Icon } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { projectStore } from '../projects.store';
import { formatDateTime } from '../task-utils';
import styles from './task-detail-dialog.module.css';

export interface TaskThreadProps {
  projectId: string;
  taskId: string;
  events: TaskEvent[];
  /** When false (e.g. a client), the activity is read-only (no commenting). */
  canEdit: boolean;
}

export function TaskThread({
  projectId,
  taskId,
  events,
  canEdit,
}: TaskThreadProps) {
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  async function post(event: React.FormEvent) {
    event.preventDefault();
    const value = body.trim();
    if (!value) return;
    setPosting(true);
    try {
      await projectStore.addComment(projectId, taskId, { body: value });
      setBody('');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className={styles.section}>
      <span className={styles.sectionLabel}>Activity</span>

      <div className={styles.thread}>
        {events.length === 0 && (
          <span className={styles.empty}>No comments or activity yet.</span>
        )}
        {events.map((ev) =>
          ev.kind === 'comment' ? (
            <div key={ev.id} className={styles.comment}>
              <UserAvatar name={ev.author} seed={ev.author} size={26} />
              <div className={styles.commentBody}>
                <div className={styles.commentHead}>
                  <span className={styles.commentAuthor}>{ev.author}</span>
                  {ev.agentName && (
                    <span className={styles.viaAgent}>
                      <Icon name="ai" size={10} />
                      {ev.agentName}
                    </span>
                  )}
                  <span className={styles.eventTime}>
                    {formatDateTime(ev.createdAt)}
                  </span>
                </div>
                <p className={styles.commentText}>{ev.body}</p>
              </div>
            </div>
          ) : (
            <div key={ev.id} className={styles.activity}>
              <Icon name="clock" size={13} tone="neutral" />
              <span className={styles.activityText}>
                <strong>{ev.author}</strong> {ev.body}
                {ev.agentName && (
                  <span className={styles.viaAgent}>
                    <Icon name="ai" size={10} />
                    {ev.agentName}
                  </span>
                )}
              </span>
              <span className={styles.eventTime}>
                {formatDateTime(ev.createdAt)}
              </span>
            </div>
          ),
        )}
      </div>

      {canEdit && (
        <form onSubmit={post} className={styles.commentForm}>
          <input
            className={styles.commentInput}
            placeholder="Write a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={posting}
          />
          <Button
            type="submit"
            size="sm"
            loading={posting}
            disabled={!body.trim()}
          >
            Comment
          </Button>
        </form>
      )}
    </div>
  );
}
