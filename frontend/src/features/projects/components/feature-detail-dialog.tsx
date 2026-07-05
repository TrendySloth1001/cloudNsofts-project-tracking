'use client';

import {
  FEATURE_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type Feature,
  type Project,
} from '@cnsofts/shared';
import { Modal } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { featureProgress, formatDate, resolveMembers } from '../task-utils';
import { FeatureStatusBadge } from './feature-status-badge';
import styles from './feature-detail-dialog.module.css';

export interface FeatureDetailDialogProps {
  open: boolean;
  onClose: () => void;
  feature: Feature | null;
  project: Project;
}

/** Read-only feature summary — used when opening a shared feature from a
 *  discussion, so people can read context without editing from the chat. */
export function FeatureDetailDialog({
  open,
  onClose,
  feature,
  project,
}: FeatureDetailDialogProps) {
  if (!feature) return null;

  const memberById = new Map(project.members.map((m) => [m.id, m]));
  const owners = resolveMembers(feature.ownerIds, memberById);
  const tasks = project.tasks.filter((t) => t.featureId === feature.id);
  const { done, total } = featureProgress(tasks);

  return (
    <Modal open={open} onClose={onClose} title={feature.name} size="md">
      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>Status</span>
          <FeatureStatusBadge status={feature.status} />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Owners</span>
          {owners.length > 0 ? (
            <span className={styles.owners}>
              {owners.map((m) => (
                <span key={m.id} className={styles.owner}>
                  <UserAvatar name={m.name} seed={m.id} size={22} />
                  {m.name}
                </span>
              ))}
            </span>
          ) : (
            <span className={styles.empty}>No owner</span>
          )}
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Target</span>
          {feature.targetDate ? (
            <span className={styles.value}>{formatDate(feature.targetDate)}</span>
          ) : (
            <span className={styles.empty}>No target date</span>
          )}
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Progress</span>
          <span className={styles.value}>
            {done}/{total} tasks done
          </span>
        </div>
      </div>

      {feature.description.trim() && (
        <p className={styles.description}>{feature.description}</p>
      )}

      <div className={styles.tasks}>
        <span className={styles.tasksLabel}>Tasks ({tasks.length})</span>
        {tasks.length === 0 ? (
          <span className={styles.empty}>No tasks in this feature yet.</span>
        ) : (
          <ul className={styles.taskList}>
            {tasks.map((task) => (
              <li key={task.id} className={styles.taskRow}>
                <span className={styles.taskTitle}>{task.title}</span>
                <span className={styles.taskStatus}>
                  {TASK_STATUS_LABELS[task.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className={styles.hint}>
        {FEATURE_STATUS_LABELS[feature.status]} feature · open the board to make
        changes.
      </p>
    </Modal>
  );
}
