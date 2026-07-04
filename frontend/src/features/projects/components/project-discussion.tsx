'use client';

import { Icon } from '@/components/ui';
import styles from './project-discussion.module.css';

/**
 * Placeholder for the project's Discussion screen — a Slack-like space to
 * communicate with the client. The messaging experience (Postgres-backed
 * channels + messages) is built as a dedicated next step.
 */
export function ProjectDiscussion() {
  return (
    <div className={styles.empty}>
      <span className={styles.icon}>
        <Icon name="chat" size={28} tone="brand" />
      </span>
      <h2 className={styles.title}>Client discussion</h2>
      <p className={styles.text}>
        A shared space to talk with the client is coming soon — messages,
        updates and files, all in one thread.
      </p>
    </div>
  );
}
