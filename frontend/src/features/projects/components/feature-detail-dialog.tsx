'use client';

import {
  FEATURE_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type Feature,
  type Project,
} from '@cnsofts/shared';
import { Icon, Modal } from '@/components/ui';
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
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Modal open={open} onClose={onClose} title={feature.name} size="md">
      {/* Summary: status + target on the left, owners on the right. */}
      <div className={styles.summary}>
        <div className={styles.summaryMeta}>
          <FeatureStatusBadge
            status={feature.status}
            size="md"
            className={styles.statusPill}
          />
          <span className={styles.metaChip}>
            <Icon name="calendar" size={14} tone="neutral" />
            {feature.targetDate ? formatDate(feature.targetDate) : 'No target'}
          </span>
        </div>
        <div className={styles.owners}>
          {owners.length > 0 ? (
            owners.map((m) => (
              <span key={m.id} className={styles.owner}>
                <UserAvatar name={m.name} seed={m.id} size={22} />
                {m.name}
              </span>
            ))
          ) : (
            <span className={styles.empty}>No owner</span>
          )}
        </div>
      </div>

      {/* Progress bar — visualizes the done/total task ratio. */}
      <div className={styles.progress}>
        <div className={styles.progressHead}>
          <span className={styles.progressLabel}>Progress</span>
          <span className={styles.progressValue}>
            {done}/{total} tasks · {percent}%
          </span>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className={styles.progressFill}
            style={{ width: `${percent}%` }}
          />
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
              <li
                key={task.id}
                className={styles.taskRow}
                data-status={task.status}
              >
                <span className={styles.taskDot} />
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
