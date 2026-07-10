'use client';

import {
  TASK_STATUS_LABELS,
  type Feature,
  type MessageAttachment,
  type Project,
  type Task,
} from '@cnsofts/shared';
import { Badge, Icon } from '@/components/ui';
import { featureProgress, formatDate } from '../task-utils';
import { TaskPriorityBadge } from './task-priority-badge';
import { TASK_STATUS_VARIANT } from './task-detail-dialog';
import { FeatureStatusBadge } from './feature-status-badge';
import { MilestoneStatusBadge } from './milestone-status-badge';
import styles from './project-discussion.module.css';

export interface MessageAttachmentCardProps {
  attachment: MessageAttachment;
  /** The project the channel belongs to (from the store cache). */
  project: Project | undefined;
  onOpenTask: (task: Task) => void;
  onOpenFeature: (feature: Feature) => void;
}

/** A shared task/feature rendered inside a channel message — a compact summary
 *  card; clicking opens the full detail in place so the conversation can
 *  continue in the channel. */
export function MessageAttachmentCard({
  attachment,
  project,
  onOpenTask,
  onOpenFeature,
}: MessageAttachmentCardProps) {
  const task =
    attachment.kind === 'task'
      ? project?.tasks.find((t) => t.id === attachment.id)
      : undefined;
  const feature =
    attachment.kind === 'feature'
      ? project?.features.find((f) => f.id === attachment.id)
      : undefined;
  const milestone =
    attachment.kind === 'milestone'
      ? project?.milestones.find((m) => m.id === attachment.id)
      : undefined;

  if (!task && !feature && !milestone) {
    return (
      <span className={styles.attachMissing}>
        <Icon name="closeCircle" size={14} />
        This {attachment.kind === 'milestone' ? 'checkpoint' : attachment.kind}{' '}
        is no longer available.
      </span>
    );
  }

  if (milestone) {
    return (
      <div className={styles.attachCard}>
        <span className={styles.attachIcon}>
          <Icon name="flag" size={16} tone="warning" />
        </span>
        <span className={styles.attachMain}>
          <span className={styles.attachTitle}>{milestone.title}</span>
          <span className={styles.attachMeta}>
            <MilestoneStatusBadge status={milestone.status} />
            {milestone.dueDate && (
              <span className={styles.attachProgress}>
                Due {formatDate(milestone.dueDate)}
              </span>
            )}
          </span>
        </span>
      </div>
    );
  }

  if (task) {
    return (
      <button
        type="button"
        className={styles.attachCard}
        onClick={() => onOpenTask(task)}
      >
        <span className={styles.attachIcon}>
          <Icon name="tasks" size={16} tone="info" />
        </span>
        <span className={styles.attachMain}>
          <span className={styles.attachTitle}>{task.title}</span>
          <span className={styles.attachMeta}>
            <Badge variant={TASK_STATUS_VARIANT[task.status]} size="sm" dot>
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
            <TaskPriorityBadge priority={task.priority} />
          </span>
        </span>
        <Icon name="chevronRight" size={16} className={styles.attachOpen} />
      </button>
    );
  }

  const { done, total } = featureProgress(
    project?.tasks.filter((t) => t.featureId === feature?.id) ?? [],
  );
  return (
    <button
      type="button"
      className={styles.attachCard}
      onClick={() => feature && onOpenFeature(feature)}
    >
      <span className={styles.attachIcon}>
        <Icon name="layers" size={16} tone="brand" />
      </span>
      <span className={styles.attachMain}>
        <span className={styles.attachTitle}>{feature?.name}</span>
        <span className={styles.attachMeta}>
          {feature && <FeatureStatusBadge status={feature.status} />}
          <span className={styles.attachProgress}>
            {done}/{total} done
          </span>
        </span>
      </span>
      <Icon name="chevronRight" size={16} className={styles.attachOpen} />
    </button>
  );
}
